/**
 * Configurazione Mapbox GL JS (stile 2D outdoor).
 * Il token pubblico (`pk.`) è una chiave pubblicabile: può stare nel client.
 * Finché non è configurato, le mappe usano il motore di riserva OpenTopoMap.
 */
export const MAPBOX_STYLE = "mapbox://styles/mapbox/outdoors-v12";

const env = import.meta.env as Record<string, string | undefined>;

export const MAPBOX_TOKEN =
  env["VITE_MAPBOX_PUBLIC_TOKEN"] ??
  env["VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN"] ??
  "";

/** True quando è disponibile un token pubblico Mapbox valido. */
export const hasMapbox = (): boolean => MAPBOX_TOKEN.startsWith("pk.");
