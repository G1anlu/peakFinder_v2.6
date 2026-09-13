/**
 * Link esterni per le strutture trovate con LocationIQ.
 * Sito ufficiale se presente nei tag OSM, altrimenti ricerca Google mirata.
 */

export {
  officialSiteUrl,
  googleSearchUrl,
  mapCoordsUrl,
  directionsCoordsUrl,
  themedImage,
} from "./locationiq";

import { mapCoordsUrl, directionsCoordsUrl } from "./locationiq";
import { ensureAbsoluteUrl } from "@/lib/url";

/** Posizione su Google Maps: coordinate se disponibili, altrimenti testo. */
export function placeUrl(
  name: string,
  coords?: { lat: number; lng: number } | null,
  address?: string | null,
): string {
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return mapCoordsUrl(coords.lat, coords.lng);
  }
  const query = encodeURIComponent([name, address].filter(Boolean).join(" "));
  return ensureAbsoluteUrl(`https://www.google.com/maps/search/?api=1&query=${query}`);
}

/** Indicazioni stradali verso il luogo. */
export function directionsUrl(
  name: string,
  coords?: { lat: number; lng: number } | null,
  address?: string | null,
): string {
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    return directionsCoordsUrl(coords.lat, coords.lng);
  }
  const destination = encodeURIComponent([name, address].filter(Boolean).join(" "));
  return ensureAbsoluteUrl(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
}
