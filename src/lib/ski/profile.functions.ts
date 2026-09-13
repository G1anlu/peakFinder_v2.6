import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SKI_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
export type SkiLevelId = (typeof SKI_LEVELS)[number];

export const SKI_LEVEL_LABELS: Record<SkiLevelId, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzato",
  expert: "Esperto",
};

export const SKI_LEVEL_DESCRIPTIONS: Record<SkiLevelId, string> = {
  beginner: "Prime discese, piste blu e campo scuola.",
  intermediate: "Piste rosse in sicurezza, giornate intere sugli sci.",
  advanced: "Piste nere, gobbe e neve battuta a ogni condizione.",
  expert: "Fuoripista, ripidi e sci alpinismo.",
};

export interface StoredProfile {
  skiLevel: SkiLevelId;
  visitedResorts: string[];
  onboardingCompleted: boolean;
  username: string;
  bio: string;
  avatarUrl: string;
}

const normalizeLevel = (value: unknown): SkiLevelId =>
  SKI_LEVELS.includes(value as SkiLevelId) ? (value as SkiLevelId) : "intermediate";

/** Profilo sciatore dell'utente autenticato (creato al primo accesso). */
export const getSkiProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StoredProfile> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("ski_level, visited_resorts, onboarding_completed, username, bio, avatar_url, email")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return {
        skiLevel: "intermediate",
        visitedResorts: [],
        onboardingCompleted: false,
        username: "",
        bio: "",
        avatarUrl: "",
      };
    }
    return {
      skiLevel: normalizeLevel(data.ski_level),
      visitedResorts: data.visited_resorts ?? [],
      onboardingCompleted: Boolean(data.onboarding_completed),
      username: data.username ?? (data.email ?? "").split("@")[0] ?? "",
      bio: data.bio ?? "",
      avatarUrl: data.avatar_url ?? "",
    };
  });

export interface SaveProfileInput {
  skiLevel?: string;
  visitedResorts?: string[];
  onboardingCompleted?: boolean;
  username?: string;
  bio?: string;
  avatarUrl?: string;
}

/** Salvataggio del profilo: la lista dei comprensori può restare vuota. */
export const saveSkiProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveProfileInput) => input)
  .handler(async ({ data, context }): Promise<StoredProfile> => {
    const { supabase, userId } = context;

    const { data: current } = await supabase
      .from("profiles")
      .select("ski_level, visited_resorts, onboarding_completed, username, bio, avatar_url, email")
      .eq("id", userId)
      .maybeSingle();

    const payload = {
      id: userId,
      ski_level: normalizeLevel(data.skiLevel ?? current?.ski_level),
      visited_resorts: Array.from(
        new Set((data.visitedResorts ?? current?.visited_resorts ?? []).filter(Boolean)),
      ).slice(0, 500),
      onboarding_completed:
        data.onboardingCompleted ?? Boolean(current?.onboarding_completed),
      username: (data.username ?? current?.username ?? "").trim().slice(0, 40) || null,
      bio: (data.bio ?? current?.bio ?? "").trim().slice(0, 400) || null,
      avatar_url: (data.avatarUrl ?? current?.avatar_url ?? "").slice(0, 400000) || null,
      email: current?.email ?? context.claims?.email ?? null,
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) {
      throw new Error(
        error.message.includes("profiles_username_lower_key")
          ? "Questo nome utente è già in uso."
          : error.message,
      );
    }
    return {
      skiLevel: payload.ski_level,
      visitedResorts: payload.visited_resorts,
      onboardingCompleted: payload.onboarding_completed,
      username: payload.username ?? "",
      bio: payload.bio ?? "",
      avatarUrl: payload.avatar_url ?? "",
    };
  });
