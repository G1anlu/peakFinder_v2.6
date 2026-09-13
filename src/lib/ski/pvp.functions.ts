import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PvpDuel {
  id: string;
  date: string;
  status: "waiting" | "matched" | "in_progress" | "completed" | "cancelled";
  /** Istante di partenza sincronizzato (countdown di 5 secondi lato DB). */
  startTime: string | null;
  player1Id: string | null;
  player2Id: string | null;
  player1: { km: number; lifts: number; score: number };
  player2: { km: number; lifts: number; score: number };
  winnerId: string | null;
}

export interface PvpOpponent {
  id: string;
  username: string;
  avatarUrl: string | null;
  eloRating: number;
}

export interface PvpStats {
  eloRating: number;
  coins: number;
  wins: number;
  losses: number;
}

type DuelRow = {
  id: string;
  date: string;
  status: string;
  player_1_id: string | null;
  player_2_id: string | null;
  player_1_km: number;
  player_2_km: number;
  player_1_lifts: number;
  player_2_lifts: number;
  player_1_score: number;
  player_2_score: number;
  winner_id: string | null;
  start_time?: string | null;
};

const toDuel = (row: DuelRow): PvpDuel => ({
  id: row.id,
  date: row.date,
  status: (row.status as PvpDuel["status"]) ?? "waiting",
  startTime: row.start_time ?? null,
  player1Id: row.player_1_id,
  player2Id: row.player_2_id,
  player1: {
    km: Number(row.player_1_km ?? 0),
    lifts: Number(row.player_1_lifts ?? 0),
    score: Number(row.player_1_score ?? 0),
  },
  player2: {
    km: Number(row.player_2_km ?? 0),
    lifts: Number(row.player_2_lifts ?? 0),
    score: Number(row.player_2_score ?? 0),
  },
  winnerId: row.winner_id,
});

const first = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

async function opponentInfo(
  supabase: { rpc: (fn: "public_profile", args: { _id: string }) => Promise<{ data: unknown }> },
  id: string | null,
): Promise<PvpOpponent | null> {
  if (!id) return null;
  const { data } = await supabase.rpc("public_profile", { _id: id });
  const row = Array.isArray(data)
    ? (data[0] as
        | { username?: string; avatar_url?: string | null; elo_rating?: number | null }
        | undefined)
    : undefined;
  return {
    id,
    username: row?.username ?? "Sciatore",
    avatarUrl: row?.avatar_url ?? null,
    eloRating: row?.elo_rating ?? 1200,
  };
}

async function readStats(
  supabase: {
    from: (t: "profiles") => {
      select: (c: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  },
  userId: string,
): Promise<PvpStats> {
  const { data } = await supabase
    .from("profiles")
    .select("elo_rating, coins, pvp_wins, pvp_losses")
    .eq("id", userId)
    .maybeSingle();
  const row = (data ?? {}) as {
    elo_rating?: number;
    coins?: number;
    pvp_wins?: number;
    pvp_losses?: number;
  };
  return {
    eloRating: row.elo_rating ?? 1200,
    coins: row.coins ?? 0,
    wins: row.pvp_wins ?? 0,
    losses: row.pvp_losses ?? 0,
  };
}

/** Sfida attiva di oggi (se esiste) + statistiche PvP dell'utente. */
export const getPvpState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("pvp_duels")
      .select("*")
      .eq("date", today)
      .or(`player_1_id.eq.${userId},player_2_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const duel = data ? toDuel(data as unknown as DuelRow) : null;
    const opponentId = duel
      ? duel.player1Id === userId
        ? duel.player2Id
        : duel.player1Id
      : null;

    return {
      duel,
      opponent: await opponentInfo(supabase as never, opponentId),
      stats: await readStats(supabase as never, userId),
      userId,
    };
  });

/** Entra in una Sfida PvP: abbinamento con avversario di Elo simile (±150). */
export const joinPvpDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("pvp_join_duel");
    if (error) throw new Error(error.message);
    const row = first(data as unknown as DuelRow | DuelRow[] | null);
    if (!row) throw new Error("Abbinamento non riuscito.");
    const duel = toDuel(row);
    const opponentId = duel.player1Id === userId ? duel.player2Id : duel.player1Id;
    return { duel, opponent: await opponentInfo(supabase as never, opponentId) };
  });

/** Registra un punto GPS e aggiorna i progressi della sfida. */
export const pushGpsProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        duelId: z.string().uuid(),
        km: z.number().min(0).max(500),
        lifts: z.number().int().min(0).max(200),
        score: z.number().min(0),
        point: z
          .object({
            latitude: z.number(),
            longitude: z.number(),
            altitude: z.number().nullable().optional(),
            speed: z.number().nullable().optional(),
            isDownhill: z.boolean().optional(),
          })
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.point) {
      await supabase.from("gps_tracks").insert({
        pvp_id: data.duelId,
        user_id: userId,
        latitude: data.point.latitude,
        longitude: data.point.longitude,
        altitude: data.point.altitude ?? null,
        speed: data.point.speed ?? null,
        is_downhill: data.point.isDownhill ?? false,
      });
    }
    const { data: row, error } = await supabase.rpc("pvp_update_progress", {
      _duel_id: data.duelId,
      _km: data.km,
      _lifts: data.lifts,
      _score: data.score,
    });
    if (error) throw new Error(error.message);
    const duelRow = first(row as unknown as DuelRow | DuelRow[] | null);
    return { duel: duelRow ? toDuel(duelRow) : null };
  });

/** Chiude la sfida: assegna Elo, monete e vittoria/sconfitta. */
export const finalizePvpDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ duelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.rpc("pvp_finalize", { _duel_id: data.duelId });
    if (error) throw new Error(error.message);
    const duelRow = first(row as unknown as DuelRow | DuelRow[] | null);
    return {
      duel: duelRow ? toDuel(duelRow) : null,
      stats: await readStats(supabase as never, userId),
    };
  });

/** Abbandona la sfida: vittoria automatica all'avversario. */
export const abandonPvpDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ duelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.rpc("pvp_forfeit", { _duel_id: data.duelId });
    if (error) throw new Error(error.message);
    const duelRow = first(row as unknown as DuelRow | DuelRow[] | null);
    return {
      duel: duelRow ? toDuel(duelRow) : null,
      stats: await readStats(supabase as never, userId),
    };
  });

/** Chiude la sfida a fine tempo: vittoria, sconfitta o pareggio perfetto. */
export const finishPvpDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ duelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.rpc("pvp_finish_duel", { _duel_id: data.duelId });
    if (error) throw new Error(error.message);
    const duelRow = first(row as unknown as DuelRow | DuelRow[] | null);
    return {
      duel: duelRow ? toDuel(duelRow) : null,
      stats: await readStats(supabase as never, userId),
    };
  });

/** Annulla la ricerca di un avversario (timeout di 5 minuti o scelta utente). */
export const cancelPvpSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ duelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase.rpc("pvp_cancel_duel", { _duel_id: data.duelId });
    if (error) throw new Error(error.message);
    const duelRow = first(row as unknown as DuelRow | DuelRow[] | null);
    return { duel: duelRow ? toDuel(duelRow) : null };
  });

/** Chiude d'ufficio le sfide rimaste aperte (evita utenti bloccati in "in corso"). */
export const closeStalePvpDuels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("pvp_close_stale_duels");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Elo e monete dell'utente autenticato (per la pagina profilo). */
export const getPvpStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PvpStats> => {
    return await readStats(context.supabase as never, context.userId);
  });
