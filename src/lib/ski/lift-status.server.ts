import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LiftStatus } from "./lifts.types";

const VALID: LiftStatus[] = ["open", "closed", "maintenance"];

let cache: { at: number; map: Map<number, LiftStatus> } | null = null;
const CACHE_MS = 60 * 1000;

/**
 * Stato operativo degli impianti (`public.lifts`): gli impianti non presenti
 * in tabella sono considerati aperti.
 */
export async function liftStatusMap(): Promise<Map<number, LiftStatus>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const map = new Map<number, LiftStatus>();
  if (!url || !key) return map;

  try {
    const supabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.from("lifts").select("id, status");
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const status = (row.status ?? "open") as LiftStatus;
      map.set(Number(row.id), VALID.includes(status) ? status : "open");
    }
  } catch {
    /* nessun override disponibile: tutti gli impianti restano aperti */
  }

  cache = { at: Date.now(), map };
  return map;
}
