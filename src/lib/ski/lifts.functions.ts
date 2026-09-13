import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LIFT_BONUS_COINS, liftHasBonus } from "./lift-bonus";
import type { LiveLift } from "./lifts.types";

export type { LiveLift };

/** Impianti (tracciato, stazioni e bonus del giorno) attorno alla posizione GPS. */
export const nearbyLiveLifts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusM: z.number().min(500).max(30000).default(8000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { liftsNear } = await import("./lifts.server");
    const { liftStatusMap } = await import("./lift-status.server");
    const statuses = await liftStatusMap();
    return {
      lifts: liftsNear(data.lat, data.lng, data.radiusM, 60, undefined, statuses),
    };
  });

/** Riscuote il bonus di un impianto completato (una sola volta al giorno). */
export const claimLiftBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ liftId: z.number().int(), liftName: z.string().max(120).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!liftHasBonus(data.liftId)) {
      return { awarded: false, coins: null as number | null, reason: "no-bonus" as const };
    }
    // Impianti chiusi o in manutenzione non assegnano bonus.
    const { liftStatusMap } = await import("./lift-status.server");
    const status = (await liftStatusMap()).get(data.liftId) ?? "open";
    if (status !== "open") {
      return { awarded: false, coins: null as number | null, reason: "no-bonus" as const };
    }
    const args: { _lift_id: number; _coins: number; _lift_name?: string } = {
      _lift_id: data.liftId,
      _coins: LIFT_BONUS_COINS,
    };
    if (data.liftName) args._lift_name = data.liftName;
    const { data: rows, error } = await context.supabase.rpc("claim_lift_bonus", args);
    if (error) throw new Error(error.message);
    const row = (Array.isArray(rows) ? rows[0] : rows) as
      | { awarded?: boolean; coins?: number }
      | null
      | undefined;
    return {
      awarded: Boolean(row?.awarded),
      coins: row?.coins ?? null,
      reason: row?.awarded ? ("ok" as const) : ("already" as const),
    };
  });
