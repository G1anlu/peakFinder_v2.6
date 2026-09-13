/**
 * Regioni italiane canoniche + classificatore geografico approssimato.
 * Serve a normalizzare le regioni dei comprensori (dataset OpenStreetMap)
 * in un unico elenco coerente per i filtri.
 */

export const ITALIAN_REGIONS = [
  "Abruzzo",
  "Basilicata",
  "Calabria",
  "Campania",
  "Emilia-Romagna",
  "Friuli-Venezia Giulia",
  "Lazio",
  "Liguria",
  "Lombardia",
  "Marche",
  "Molise",
  "Piemonte",
  "Puglia",
  "Sardegna",
  "Sicilia",
  "Toscana",
  "Trentino-Alto Adige",
  "Umbria",
  "Valle d'Aosta",
  "Veneto",
] as const;

export type ItalianRegion = (typeof ITALIAN_REGIONS)[number];

/** Alias e sotto-aree ricondotte alla regione canonica. */
const ALIASES: Array<[RegExp, ItalianRegion]> = [
  [/valle d.?aosta|aosta|vallee/i, "Valle d'Aosta"],
  [/piemont/i, "Piemonte"],
  [/lombard/i, "Lombardia"],
  [/trentino|alto adige|sudtirol|südtirol|south tyrol|dolomiti di brenta|alta badia/i, "Trentino-Alto Adige"],
  [/veneto|cadore|belluno/i, "Veneto"],
  [/friuli|venezia giulia/i, "Friuli-Venezia Giulia"],
  [/liguria/i, "Liguria"],
  [/emilia|romagna/i, "Emilia-Romagna"],
  [/toscan/i, "Toscana"],
  [/marche/i, "Marche"],
  [/umbria/i, "Umbria"],
  [/abruzzo|marsica|alto sangro|gran sasso|majella/i, "Abruzzo"],
  [/lazio/i, "Lazio"],
  [/molise/i, "Molise"],
  [/campania/i, "Campania"],
  [/basilicata/i, "Basilicata"],
  [/calabria|sila|pollino/i, "Calabria"],
  [/sicil|etna/i, "Sicilia"],
  [/sardegna|sardinia/i, "Sardegna"],
  [/puglia|apulia/i, "Puglia"],
];

/** Riporta un nome di regione libero alla regione italiana canonica. */
export function canonicalRegionName(value: string | null | undefined): ItalianRegion | null {
  if (!value) return null;
  for (const [re, region] of ALIASES) if (re.test(value)) return region;
  return null;
}

interface Box {
  region: ItalianRegion;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

/** Riquadri approssimati: usati solo quando manca un riferimento migliore. */
const BOXES: Box[] = [
  { region: "Valle d'Aosta", latMin: 45.45, latMax: 46.0, lngMin: 6.75, lngMax: 7.95 },
  { region: "Piemonte", latMin: 44.0, latMax: 46.5, lngMin: 6.6, lngMax: 9.25 },
  { region: "Lombardia", latMin: 44.6, latMax: 46.65, lngMin: 8.5, lngMax: 10.7 },
  { region: "Trentino-Alto Adige", latMin: 45.65, latMax: 47.1, lngMin: 10.45, lngMax: 12.5 },
  { region: "Veneto", latMin: 44.8, latMax: 46.7, lngMin: 10.6, lngMax: 13.1 },
  { region: "Friuli-Venezia Giulia", latMin: 45.5, latMax: 46.7, lngMin: 12.3, lngMax: 13.95 },
  { region: "Liguria", latMin: 43.7, latMax: 44.7, lngMin: 7.4, lngMax: 10.1 },
  { region: "Emilia-Romagna", latMin: 43.7, latMax: 45.2, lngMin: 9.2, lngMax: 12.8 },
  { region: "Toscana", latMin: 42.2, latMax: 44.5, lngMin: 9.6, lngMax: 12.4 },
  { region: "Marche", latMin: 42.6, latMax: 44.0, lngMin: 12.2, lngMax: 13.9 },
  { region: "Umbria", latMin: 42.3, latMax: 43.65, lngMin: 11.9, lngMax: 13.3 },
  { region: "Abruzzo", latMin: 41.6, latMax: 42.95, lngMin: 13.0, lngMax: 14.85 },
  { region: "Lazio", latMin: 40.7, latMax: 42.8, lngMin: 11.4, lngMax: 14.1 },
  { region: "Molise", latMin: 41.3, latMax: 42.1, lngMin: 14.0, lngMax: 15.2 },
  { region: "Campania", latMin: 39.9, latMax: 41.5, lngMin: 13.7, lngMax: 15.8 },
  { region: "Puglia", latMin: 39.8, latMax: 42.0, lngMin: 14.9, lngMax: 18.6 },
  { region: "Basilicata", latMin: 39.9, latMax: 41.1, lngMin: 15.3, lngMax: 16.9 },
  { region: "Calabria", latMin: 37.9, latMax: 40.2, lngMin: 15.6, lngMax: 17.3 },
  { region: "Sicilia", latMin: 36.6, latMax: 38.4, lngMin: 12.3, lngMax: 15.7 },
  { region: "Sardegna", latMin: 38.8, latMax: 41.4, lngMin: 8.1, lngMax: 9.9 },
];

/** Regioni compatibili con una coordinata (possono essere più di una). */
export function regionCandidates(lat: number, lng: number): ItalianRegion[] {
  return BOXES.filter(
    (b) => lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax,
  ).map((b) => b.region);
}
