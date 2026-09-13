import liftsIndex from "@/data/impianti-index.json";
import fullDataset from "@/data/impianti-italia.json";
import { haversineMeters } from "./geo";
import { liftHasBonus, todayKey } from "./lift-bonus";

import type { LiftEntry, LiftStatus, LiveLift } from "./lifts.types";

interface RawLift {
  id: number;
  name: string | null;
  type: string | null;
  active: boolean | null;
  length_m: number | null;
  resort_name: string | null;
  geometry: Array<[number, number]> | null;
  base: { lat: number; lng: number; ele: number | null } | null;
  top: { lat: number; lng: number; ele: number | null } | null;
}

export type { LiftEntry, LiveLift };

const ALL = liftsIndex as unknown as LiftEntry[];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Ricerca impianti per nome impianto o nome comprensorio. */
export function findLifts(query: string, limit = 12): LiftEntry[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored: Array<{ lift: LiftEntry; score: number }> = [];
  for (const lift of ALL) {
    const name = normalize(lift.name);
    const resort = normalize(lift.resortName ?? lift.resort ?? "");
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (resort.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else if (resort.includes(q)) score = 3;
    if (score < 0) continue;
    if (lift.active === false) score += 4;
    scored.push({ lift, score });
    if (scored.length > 400) break;
  }
  scored.sort((a, b) => a.score - b.score || a.lift.name.localeCompare(b.lift.name));
  return scored.slice(0, limit).map((s) => s.lift);
}

/** Impianti con geometria completa entro un raggio dalla posizione GPS. */
export function liftsNear(
  lat: number,
  lng: number,
  radiusM = 8000,
  limit = 60,
  day?: string,
  statuses?: Map<number, LiftStatus>,
): LiveLift[] {
  const dataset = (fullDataset as unknown as { lifts: RawLift[] }).lifts;
  const found: Array<{ lift: LiveLift; d: number }> = [];
  for (const raw of dataset) {
    if (!raw.base || !raw.top || !raw.geometry || raw.geometry.length < 2) continue;
    const d = haversineMeters({ lat, lng }, { lat: raw.base.lat, lng: raw.base.lng });
    if (d > radiusM) continue;
    // Stato dal database; senza override l'impianto è aperto (o chiuso se OSM lo segnala inattivo).
    const status: LiftStatus =
      statuses?.get(raw.id) ?? (raw.active === false ? "closed" : "open");
    found.push({
      d,
      lift: {
        id: raw.id,
        name: raw.name ?? "Impianto",
        type: raw.type ?? null,
        active: status === "open",
        status,
        resortName: raw.resort_name ?? null,
        geometry: raw.geometry,
        base: raw.base,
        top: raw.top,
        lengthM: raw.length_m ?? null,
        // Nessun bonus sugli impianti chiusi o in manutenzione.
        hasBonus: status === "open" && liftHasBonus(raw.id, day ?? todayKey()),
      },
    });
  }
  found.sort((a, b) => a.d - b.d);
  return found.slice(0, limit).map((f) => f.lift);
}
