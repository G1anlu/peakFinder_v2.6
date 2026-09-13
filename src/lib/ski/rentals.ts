/**
 * Architettura noleggi sci a 2 livelli.
 *
 * LIVELLO 1 - Network ufficiali (Skiset, Skimium, Intersport Rent):
 * listino reale per categoria di attrezzatura, badge "Verificato Partner"
 * e link diretto di prenotazione con Partner ID.
 *
 * LIVELLO 2 - Noleggi indipendenti da LocationIQ/OpenStreetMap:
 * nessun listino pubblico, quindi la fascia viene stimata in graduatoria
 * rispetto ai prezzi reali del Livello 1, usando posizione e servizi OSM.
 */

import type { PriceTier } from "./tier";
import type { SkierLevel } from "./types";

export type RentalCategory = "base" | "performance" | "race";

export const RENTAL_CATEGORY_LABEL: Record<RentalCategory, string> = {
  base: "Attrezzatura base / principiante",
  performance: "Attrezzatura intermedia / advanced",
  race: "Attrezzatura pro / race",
};

/** Il livello dello sciatore determina la categoria di attrezzatura. */
export function categoryFromLevel(level?: SkierLevel | null): RentalCategory {
  if (level === "beginner") return "base";
  if (level === "advanced") return "race";
  return "performance";
}

export const CATEGORY_TIER: Record<RentalCategory, PriceTier> = {
  base: "budget",
  performance: "standard",
  race: "luxury",
};

export interface RentalNetwork {
  id: "skiset" | "skimium" | "intersport";
  label: string;
  /** Listino reale del network, EUR al giorno per categoria. */
  priceList: Record<RentalCategory, number>;
  /** Parole chiave con cui il network appare su OSM (name / brand). */
  keywords: string[];
}

export const RENTAL_NETWORKS: RentalNetwork[] = [
  {
    id: "skiset",
    label: "Skiset",
    priceList: { base: 21, performance: 34, race: 52 },
    keywords: ["skiset"],
  },
  {
    id: "skimium",
    label: "Skimium",
    priceList: { base: 20, performance: 32, race: 49 },
    keywords: ["skimium"],
  },
  {
    id: "intersport",
    label: "Intersport Rent",
    priceList: { base: 24, performance: 39, race: 58 },
    keywords: ["intersport", "intersport rent"],
  },
];

/** Riconosce un network ufficiale dal nome, dal brand o dal sito OSM. */
export function detectNetwork(place: {
  name?: string | null;
  brand?: string | null;
  websiteUri?: string | null;
}): RentalNetwork | null {
  const hay = [place.name, place.brand, place.websiteUri]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!hay) return null;
  return RENTAL_NETWORKS.find((n) => n.keywords.some((k) => hay.includes(k))) ?? null;
}

const VIP_WORDS = ["ski-in", "ski in", "premium", "vip", "race", "boot fitting", "test center"];

/**
 * Livello 2: fascia stimata dalla graduatoria del Livello 1.
 * - adiacente a piste/telecabine (<= 300 m) o servizi VIP -> Top (€€€)
 * - centro paese / distanza media (<= 500 m) -> Standard (€€)
 * - negozio periferico o distante (> 500 m) -> Economica (€)
 */
export function estimateTierFromContext(place: {
  name?: string | null;
  distanceM?: number | null;
}): PriceTier {
  const hay = (place.name ?? "").toLowerCase();
  if (VIP_WORDS.some((w) => hay.includes(w))) return "luxury";
  const d = typeof place.distanceM === "number" ? place.distanceM : null;
  if (d === null) return "standard";
  if (d <= 300) return "luxury";
  if (d <= 500) return "standard";
  return "budget";
}

/** Intervallo di riferimento del Livello 1 per una fascia e una categoria. */
export function networkPriceRange(
  tier: PriceTier,
  category: RentalCategory,
): { min: number; max: number } {
  const prices = RENTAL_NETWORKS.map((n) => n.priceList[category]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  // La fascia sposta l'intervallo indicativo attorno al listino reale.
  if (tier === "budget") return { min: Math.round(min * 0.75), max: min };
  if (tier === "luxury") return { min: max, max: Math.round(max * 1.35) };
  return { min, max };
}

export const RENTAL_ESTIMATE_NOTE =
  "Fascia stimata in base a posizione e servizi. Verifica listino esatto sul sito del noleggio.";

export interface RentalInfo {
  /** Network ufficiale (Livello 1) oppure null (Livello 2). */
  network: RentalNetwork | null;
  verified: boolean;
  tier: PriceTier;
  /** Prezzo reale al giorno: solo Livello 1. */
  realPrice: number | null;
  /** Intervallo indicativo per il Livello 2. */
  estimatedRange: { min: number; max: number } | null;
}

export function rentalInfo(
  place: { name?: string | null; brand?: string | null; websiteUri?: string | null; distanceM?: number | null },
  category: RentalCategory,
): RentalInfo {
  const network = detectNetwork(place);
  if (network) {
    return {
      network,
      verified: true,
      tier: CATEGORY_TIER[category],
      realPrice: network.priceList[category],
      estimatedRange: null,
    };
  }
  const tier = estimateTierFromContext(place);
  return {
    network: null,
    verified: false,
    tier,
    realPrice: null,
    estimatedRange: networkPriceRange(tier, category),
  };
}

/** Livello 1 sempre in cima, poi fascia alta e distanza crescente. */
export function sortRentals<T extends { name?: string | null; brand?: string | null; websiteUri?: string | null; distanceM?: number | null }>(
  places: T[],
  category: RentalCategory,
): T[] {
  const rank: Record<PriceTier, number> = { luxury: 0, standard: 1, budget: 2 };
  return [...places].sort((a, b) => {
    const ia = rentalInfo(a, category);
    const ib = rentalInfo(b, category);
    if (ia.verified !== ib.verified) return ia.verified ? -1 : 1;
    if (rank[ia.tier] !== rank[ib.tier]) return rank[ia.tier] - rank[ib.tier];
    return (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9);
  });
}
