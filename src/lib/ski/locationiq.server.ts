/**
 * Chiamate server-side alle API gratuite LocationIQ (Nearby, Search, Reverse,
 * Directions), su dati OpenStreetMap.
 */

const TOKEN =
  process.env["LOCATIONIQ_TOKEN"] ||
  process.env["VITE_LOCATIONIQ_TOKEN"] ||
  "pk.da0eabc0886f87526d369ff257271c47";

const BASE = "https://us1.locationiq.com/v1";

/** Il piano gratuito LocationIQ limita a 1 richiesta al secondo: un retry. */
async function liqFetch(url: string): Promise<Response> {
  let res = await fetch(url);
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await fetch(url);
  }
  return res;
}

export interface NearbyItem {
  provider: "locationiq";
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  website: string | null;
  distanceM: number | null;
  /** Metadati OSM aggiuntivi (utili per i noleggi indipendenti). */
  brand: string | null;
  phone: string | null;
  openingHours: string | null;
}

interface RawNearby {
  place_id?: string | number;
  osm_id?: string | number;
  name?: string;
  display_name?: string;
  lat?: string | number;
  lon?: string | number;
  distance?: number;
  website?: string;
  url?: string;
  address?: Record<string, string | undefined>;
  extratags?: Record<string, string | undefined>;
}

const numeric = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function formatAddress(raw: RawNearby): string {
  const a = raw.address ?? {};
  const parts = [
    [a["road"], a["house_number"]].filter(Boolean).join(" "),
    a["village"] ?? a["town"] ?? a["city"] ?? a["hamlet"],
    a["postcode"],
    a["county"] ?? a["state"],
  ].filter((p): p is string => Boolean(p && p.trim()));
  if (parts.length > 0) return parts.join(", ");
  return raw.display_name ?? "";
}

/** Tag LocationIQ usati per alloggi e noleggi/negozi sportivi. */
export const NEARBY_TAG: Record<"hotel" | "rental", string> = {
  // Alloggi (lodging) e negozi sportivi / noleggio sci nella tassonomia OSM.
  hotel: "hotel,tourism:chalet,tourism:apartment,tourism:hostel,tourism:motel,tourism:guest_house",
  // Tutte le varianti OSM del noleggio sci: copertura ampia anche nelle
  // località minori (raggio fino a 25 km).
  rental:
    "shop:ski,amenity:ski_rental,shop:sports,shop:outdoor,shop:rental,shop:bicycle," +
    "leisure:sports_centre,sport:skiing,rental:ski",
};

/** Chiave di deduplica: stesso ID OSM oppure coordinate entro ~50 m. */
function dedupe(items: NearbyItem[]): NearbyItem[] {
  const seenIds = new Set<string>();
  const out: NearbyItem[] = [];
  for (const item of items) {
    if (seenIds.has(item.placeId)) continue;
    const near = out.some(
      (o) =>
        o.name.toLowerCase() === item.name.toLowerCase() ||
        (Math.abs(o.lat - item.lat) < 0.0005 && Math.abs(o.lng - item.lng) < 0.0005),
    );
    if (near) continue;
    seenIds.add(item.placeId);
    out.push(item);
  }
  return out;
}

/** Strutture vicine alle coordinate del comprensorio. */
export async function locationiqNearby(params: {
  lat: number;
  lng: number;
  kind: "hotel" | "rental";
  radiusM?: number;
}): Promise<{ places: NearbyItem[]; error: string | null }> {
  const radius = params.radiusM ?? 25000;
  const url =
    `${BASE}/nearby?key=${TOKEN}&lat=${params.lat}&lon=${params.lng}` +
    `&tag=${NEARBY_TAG[params.kind]}&radius=${radius}&limit=50&format=json`;

  try {
    const res = await liqFetch(url);
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error(`LocationIQ nearby ${res.status}: ${body}`);
      if (res.status === 404) return { places: [], error: null };
      return { places: [], error: `LocationIQ ha risposto ${res.status}.` };
    }
    const json = (await res.json()) as RawNearby[] | { error?: string };
    if (!Array.isArray(json)) return { places: [], error: null };

    const places = dedupe(
      json
        .map((raw): NearbyItem | null => {
          const lat = numeric(raw.lat);
          const lng = numeric(raw.lon);
          if (lat === null || lng === null) return null;
          const name = raw.name ?? raw.display_name?.split(",")[0]?.trim() ?? "";
          if (!name) return null;
          return {
            provider: "locationiq",
            placeId: String(raw.place_id ?? raw.osm_id ?? `${lat},${lng}`),
            name,
            address: formatAddress(raw),
            lat,
            lng,
            website: raw.website ?? raw.extratags?.["website"] ?? raw.url ?? null,
            distanceM: typeof raw.distance === "number" ? Math.round(raw.distance) : null,
            brand: raw.extratags?.["brand"] ?? null,
            phone:
              raw.extratags?.["phone"] ?? raw.extratags?.["contact:phone"] ?? null,
            openingHours: raw.extratags?.["opening_hours"] ?? null,
          };
        })
        .filter((p): p is NearbyItem => p !== null),
    ).sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9));


    return { places, error: null };
  } catch (err) {
    console.error("LocationIQ nearby errore di rete", err);
    return { places: [], error: "Rete non disponibile verso LocationIQ." };
  }
}

/** Ricerca testuale di luoghi/indirizzi (Search / Forward geocoding). */
export async function locationiqSearch(query: string) {
  const url =
    `${BASE}/search?key=${TOKEN}&q=${encodeURIComponent(query)}` +
    `&format=json&limit=5&addressdetails=1&accept-language=it`;
  try {
    const res = await liqFetch(url);
    if (!res.ok) {
      if (res.status === 404) return { places: [], error: null as string | null };
      return { places: [], error: `LocationIQ ha risposto ${res.status}.` };
    }
    const json = (await res.json()) as RawNearby[];
    return {
      error: null as string | null,
      places: (Array.isArray(json) ? json : [])
        .map((raw) => {
          const lat = numeric(raw.lat);
          const lng = numeric(raw.lon);
          if (lat === null || lng === null) return null;
          return {
            id: String(raw.place_id ?? `${lat},${lng}`),
            name: raw.display_name?.split(",")[0]?.trim() ?? raw.display_name ?? "",
            address: raw.display_name ?? "",
            lat,
            lng,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
    };
  } catch (err) {
    console.error("LocationIQ search errore di rete", err);
    return { places: [], error: "Rete non disponibile verso LocationIQ." };
  }
}

/** Indirizzo leggibile da coordinate GPS (Reverse geocoding). */
export async function locationiqReverse(lat: number, lng: number) {
  const url = `${BASE}/reverse?key=${TOKEN}&lat=${lat}&lon=${lng}&format=json&accept-language=it`;
  try {
    const res = await liqFetch(url);
    if (!res.ok) return { address: null as string | null, error: null as string | null };
    const json = (await res.json()) as { display_name?: string };
    return { address: json.display_name ?? null, error: null as string | null };
  } catch {
    return { address: null as string | null, error: "Rete non disponibile verso LocationIQ." };
  }
}

/** Percorso in auto tra due punti (LocationIQ Directions, OSRM). */
export async function locationiqRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<{ distanceKm: number; durationHours: number; polyline?: string } | null> {
  const url =
    `${BASE}/directions/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?key=${TOKEN}&overview=simplified&geometries=polyline&steps=false`;
  try {
    const res = await liqFetch(url);
    if (!res.ok) {
      console.error(`LocationIQ directions ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const json = (await res.json()) as {
      routes?: Array<{ distance?: number; duration?: number; geometry?: string }>;
    };
    const route = json.routes?.[0];
    if (!route?.distance || !route.duration) return null;
    return {
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationHours: Math.round((route.duration / 3600) * 100) / 100,
      ...(route.geometry ? { polyline: route.geometry } : {}),
    };
  } catch (err) {
    console.error("LocationIQ directions errore di rete", err);
    return null;
  }
}
