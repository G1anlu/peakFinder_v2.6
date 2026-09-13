import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SkiLevelId } from "@/lib/ski/profile.functions";

export interface UserSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
  /** Punteggio Elo pubblico (le monete restano private). */
  eloRating: number;
}

export interface FriendProfile extends UserSummary {
  isFriend: boolean;
  bio: string | null;
  skiLevel: SkiLevelId | null;
  visitedResorts: string[] | null;
}

export type FriendState = "none" | "pending_out" | "pending_in" | "friends" | "declined";

/** Riprova le chiamate al database quando la rete fallisce temporaneamente (DNS/fetch). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? `${err.message} ${String((err as { cause?: unknown }).cause ?? "")}` : "";
      const transient = /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|socket hang up/i.test(message);
      if (!transient || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 200 * 2 ** i));
    }
  }
  throw lastError;
}

export interface FriendEdge {
  id: string;
  user: UserSummary;
  status: "pending" | "accepted" | "declined";
  direction: "incoming" | "outgoing";
  createdAt: string;
}

/** Ricerca utenti per nome utente (parziale) o email (esatta). */
export const searchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ query: z.string().max(120) }).parse(data))
  .handler(async ({ data, context }): Promise<{ users: UserSummary[] }> => {
    const q = data.query.trim();
    if (q.length < 2) return { users: [] };
    const { data: rows, error } = await withRetry(
      async () => await context.supabase.rpc("search_users", { _q: q }),
    );
    if (error) throw new Error(error.message);
    return {
      users: (rows ?? []).map((r) => ({
        id: r.id,
        username: r.username ?? "Sciatore",
        avatarUrl: r.avatar_url,
        eloRating: r.elo_rating ?? 1200,
      })),
    };
  });

/** Scheda di un altro utente: dati completi solo se siete amici. */
export const getUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ profile: FriendProfile | null; state: FriendState }> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await withRetry(
      async () => await supabase.rpc("public_profile", { _id: data.userId }),
    );
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return { profile: null, state: "none" };

    const { data: link } = await supabase
      .from("friendships")
      .select("status, requester_id, addressee_id")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
      )
      .maybeSingle();

    let state: FriendState = "none";
    if (link) {
      if (link.status === "accepted") state = "friends";
      else if (link.status === "declined") state = "declined";
      else state = link.requester_id === userId ? "pending_out" : "pending_in";
    }

    return {
      profile: {
        id: row.id,
        username: row.username ?? "Sciatore",
        avatarUrl: row.avatar_url,
        eloRating: row.elo_rating ?? 1200,
        isFriend: Boolean(row.is_friend),
        bio: row.bio,
        skiLevel: (row.ski_level as SkiLevelId | null) ?? null,
        visitedResorts: row.visited_resorts,
      },
      state,
    };
  });

/** Invia (o rinnova) una richiesta di amicizia. */
export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("Non puoi aggiungere te stesso.");
    const { error } = await supabase
      .from("friendships")
      .upsert(
        { requester_id: userId, addressee_id: data.userId, status: "pending" },
        { onConflict: "requester_id,addressee_id" },
      );
    if (error?.code === "23505") {
      const { error: retryError } = await supabase
        .from("friendships")
        .update({ requester_id: userId, addressee_id: data.userId, status: "pending" })
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${data.userId}),and(requester_id.eq.${data.userId},addressee_id.eq.${userId})`,
        );
      if (retryError) throw new Error(retryError.message);
    } else if (error) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Accetta o rifiuta una richiesta ricevuta. */
export const respondToFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), accept: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("friendships")
      .update({ status: data.accept ? "accepted" : "declined" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Rimuove un'amicizia o annulla una richiesta. */
export const removeFriendship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("friendships").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Amici confermati e richieste in sospeso (in entrata e in uscita). */
export const listFriendships = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ friends: FriendEdge[]; incoming: FriendEdge[]; outgoing: FriendEdge[] }> => {
      const { supabase, userId } = context;
      const { data: rows, error } = await withRetry(
        async () =>
          await supabase
            .from("friendships")
            .select("id, status, requester_id, addressee_id, created_at")
            .order("created_at", { ascending: false }),
      );
      if (error) throw new Error(error.message);

      const others = Array.from(
        new Set(
          (rows ?? []).map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id)),
        ),
      );

      const profiles = new Map<string, UserSummary>();
      await Promise.all(
        others.map(async (id) => {
          const { data: p } = await withRetry(
            async () => await supabase.rpc("public_profile", { _id: id }),
          ).catch(() => ({ data: null }));
          const row = p?.[0];
          profiles.set(id, {
            id,
            username: row?.username ?? "Sciatore",
            avatarUrl: row?.avatar_url ?? null,
            eloRating: row?.elo_rating ?? 1200,
          });
        }),
      );

      const friends: FriendEdge[] = [];
      const incoming: FriendEdge[] = [];
      const outgoing: FriendEdge[] = [];

      for (const r of rows ?? []) {
        const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
        const edge: FriendEdge = {
          id: r.id,
          user: profiles.get(otherId) ?? { id: otherId, username: "Sciatore", avatarUrl: null, eloRating: 1200 },
          status: r.status as FriendEdge["status"],
          direction: r.requester_id === userId ? "outgoing" : "incoming",
          createdAt: r.created_at,
        };
        if (r.status === "accepted") friends.push(edge);
        else if (r.status === "pending" && edge.direction === "incoming") incoming.push(edge);
        else if (r.status === "pending") outgoing.push(edge);
      }

      return { friends, incoming, outgoing };
    },
  );

/** Rimuove definitivamente un'amicizia (in qualsiasi direzione). */
export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await withRetry(
      async () => await context.supabase.rpc("remove_friend", { friend_user_id: data.userId }),
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Elimina l'account dell'utente e tutti i suoi dati. */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await withRetry(async () => await context.supabase.rpc("delete_own_account"));
    if (error) throw new Error(error.message);
    return { ok: true };
  });
