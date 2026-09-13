/**
 * Link di prenotazione / affiliazione per i noleggi sci.
 *
 * LIVELLO 1 — network verificati (Skiset, Skimium, Intersport Rent):
 * deep link al portale del partner con Partner ID e località sciistica.
 * LIVELLO 2 — noleggi indipendenti (LocationIQ / OpenStreetMap):
 * sito ufficiale dai metadati, altrimenti ricerca Google mirata.
 */

import { detectNetwork } from "@/lib/ski/rentals";
import { ensureAbsoluteUrl } from "@/lib/url";

const env = import.meta.env as Record<string, string | undefined>;

const partner = (key: string) => env[key] || env["VITE_RENTAL_PARTNER_ID"] || "PEAKFINDER";

export function getRentalAffiliateUrl(
  rentalName: string,
  resortName: string,
  websiteUri?: string | null,
): string {
  const resort = encodeURIComponent(resortName ?? "");
  const network = detectNetwork({ name: rentalName, websiteUri: websiteUri ?? null });

  if (network?.id === "skiset") {
    return `https://www.skiset.com/partner/${partner("VITE_SKISET_PARTNER_ID")}/resort/${resort}`;
  }
  if (network?.id === "skimium") {
    return `https://www.skimium.it/?partner=${partner("VITE_SKIMIUM_PARTNER_ID")}&resort=${resort}`;
  }
  if (network?.id === "intersport") {
    return `https://www.intersportrent.com/search?resort=${resort}&partner=${partner(
      "VITE_INTERSPORT_PARTNER_ID",
    )}`;
  }

  // Livello 2: sito ufficiale della struttura, altrimenti ricerca Google.
  const site = websiteUri ? ensureAbsoluteUrl(websiteUri) : null;
  if (site) return site;
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${rentalName} ${resortName} noleggio sci prenotazione`,
  )}`;
}
