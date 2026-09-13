/**
 * Classificazione in fasce di prezzo (€ / €€ / €€€) delle strutture LocationIQ
 * e stima dei costi coerente con la fascia attribuita.
 */

import type { HotelCategory } from "./types";

export type PriceTier = "budget" | "standard" | "luxury";

export const TIER_SYMBOL: Record<PriceTier, string> = {
  budget: "€",
  standard: "€€",
  luxury: "€€€",
};

export const TIER_LABEL: Record<PriceTier, string> = {
  budget: "Economico",
  standard: "Standard",
  luxury: "Lusso",
};

const LUXURY_WORDS = [
  "grand",
  "resort",
  "spa",
  "5 star",
  "5-star",
  "luxury",
  "boutique",
  "palace",
  "wellness",
  "relais",
];

const STANDARD_WORDS = [
  "hotel",
  "alpen",
  "alpin",
  "chalet",
  "garni",
  "residence",
  "mountain",
  "sporthotel",
];

const BUDGET_WORDS = [
  "b&b",
  "bed & breakfast",
  "bed and breakfast",
  "ostello",
  "hostel",
  "guest house",
  "guesthouse",
  "rifugio",
  "economy",
  "camping",
  "affittacamere",
];

/** Fascia di prezzo dedotta dal nome della struttura. */
export function classifyTier(name: string): PriceTier {
  const n = (name ?? "").toLowerCase();
  if (BUDGET_WORDS.some((w) => n.includes(w))) return "budget";
  if (LUXURY_WORDS.some((w) => n.includes(w))) return "luxury";
  if (STANDARD_WORDS.some((w) => n.includes(w))) return "standard";
  return "standard";
}

/** Fascia dedotta dal prezzo reale per notte (soglie 100 € / 250 €). */
export function tierFromPrice(pricePerNight: number): PriceTier {
  if (pricePerNight < 100) return "budget";
  if (pricePerNight <= 250) return "standard";
  return "luxury";
}

/**
 * Fascia definitiva: quando esiste un prezzo reale (Booking) vince sempre
 * sull'euristica basata sul nome.
 */
export function resolveTier(name: string, pricePerNight?: number | null): PriceTier {
  if (typeof pricePerNight === "number" && Number.isFinite(pricePerNight) && pricePerNight > 0) {
    return tierFromPrice(pricePerNight);
  }
  return classifyTier(name);
}


/** Hash stabile: la stessa struttura ottiene sempre lo stesso prezzo. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const HOTEL_RANGE: Record<PriceTier, [number, number]> = {
  budget: [50, 75],
  standard: [85, 140],
  luxury: [160, 320],
};

const RENTAL_RANGE: Record<PriceTier, [number, number]> = {
  budget: [18, 25],
  standard: [28, 38],
  luxury: [45, 65],
};

/** Prezzo stimato deterministico all'interno della fascia. */
export function tierPrice(kind: "hotel" | "rental", tier: PriceTier, seed: string): number {
  const [min, max] = kind === "hotel" ? HOTEL_RANGE[tier] : RENTAL_RANGE[tier];
  const span = max - min;
  return min + (hash(seed) % (span + 1));
}

/** Preferenza dell'itinerario tradotta in fascia. */
export function tierFromPreference(category?: HotelCategory | null): PriceTier | null {
  if (category === "budget") return "budget";
  if (category === "comfort") return "standard";
  if (category === "luxury") return "luxury";
  return null;
}

const ORDER: Record<PriceTier, number> = { budget: 0, standard: 1, luxury: 2 };

/**
 * Ordina le strutture portando in cima quelle della fascia preferita,
 * mantenendo la vicinanza come criterio secondario.
 */
export function sortByPreference<T extends { name: string; distanceM?: number | null }>(
  places: T[],
  preferred: PriceTier | null,
): T[] {
  return [...places].sort((a, b) => {
    const ta = classifyTier(a.name);
    const tb = classifyTier(b.name);
    if (preferred) {
      const pa = ta === preferred ? 0 : Math.abs(ORDER[ta] - ORDER[preferred]);
      const pb = tb === preferred ? 0 : Math.abs(ORDER[tb] - ORDER[preferred]);
      if (pa !== pb) return pa - pb;
    }
    return (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9);
  });
}
