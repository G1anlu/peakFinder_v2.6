import type { PisteLine, PisteDifficulty } from "./lifts.types";

const OVERPASS = "https://overpass-api.de/api/interpreter";

interface OverpassWay {
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

const DIFFICULTIES: PisteDifficulty[] = ["novice", "easy", "intermediate", "advanced", "expert"];

function toDifficulty(value: string | undefined): PisteDifficulty {
  if (value && (DIFFICULTIES as string[]).includes(value)) return value as PisteDifficulty;
  return "unknown";
}

/** Cache in memoria (breve) per non ripetere le stesse chiamate Overpass. */
const cache = new Map<string, { at: number; pistes: PisteLine[] }>();
const TTL_MS = 1000 * 60 * 30;

/** Piste da discesa attorno a una posizione, dai dati OpenStreetMap. */
export async function pistesNear(lat: number, lng: number, radiusM = 8000): Promise<PisteLine[]> {
  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}:${radiusM}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.pistes;

  const query = `[out:json][timeout:25];way["piste:type"="downhill"](around:${radiusM},${lat},${lng});out geom;`;
  let pistes: PisteLine[] = [];
  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    const json = (await res.json()) as { elements?: OverpassWay[] };
    pistes = (json.elements ?? [])
      .filter((w) => (w.geometry?.length ?? 0) >= 2)
      .slice(0, 400)
      .map((w) => ({
        id: w.id,
        name: w.tags?.["name"] ?? w.tags?.["ref"] ?? null,
        difficulty: toDifficulty(w.tags?.["piste:difficulty"]),
        geometry: (w.geometry ?? []).map((p) => [p.lat, p.lon] as [number, number]),
      }));
    cache.set(key, { at: Date.now(), pistes });
  } catch {
    return hit?.pistes ?? [];
  }
  return pistes;
}
