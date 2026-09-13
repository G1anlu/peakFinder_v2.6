/**
 * Configurazione e helper condivisi per LocationIQ (mappe + ricerca POI).
 * Il token è di tipo pubblicabile (pk.*): può stare nel bundle browser.
 */

import { ensureAbsoluteUrl } from "@/lib/url";

const FALLBACK_TOKEN = "pk.da0eabc0886f87526d369ff257271c47";

/** Token LocationIQ lato browser. */
export const LOCATIONIQ_TOKEN =
  (import.meta.env["VITE_LOCATIONIQ_TOKEN"] as string | undefined) || FALLBACK_TOKEN;

/** Tile layer Leaflet servito da LocationIQ. */
export const LOCATIONIQ_TILE_URL = `https://tiles.locationiq.com/v3/streets/r/{z}/{x}/{y}.png?key=${LOCATIONIQ_TOKEN}`;

export const LOCATIONIQ_ATTRIBUTION =
  '&copy; <a href="https://locationiq.com">LocationIQ</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const LOCATIONIQ_MAX_ZOOM = 18;

/* ------------------------------------------------------------------ */
/* Immagini tematiche di fallback (LocationIQ non fornisce gallerie)   */
/* ------------------------------------------------------------------ */

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;

const HOTEL_IMAGES = [
  UNSPLASH("1551882547-ff40c63fe5fa"),
  UNSPLASH("1520250497591-112f2f40a3f4"),
  UNSPLASH("1517320964276-a002fa203177"),
  UNSPLASH("1476514525535-07fb3b4ae5f1"),
  UNSPLASH("1571003123894-1f0594d2b5d9"),
  UNSPLASH("1595576508898-0ad5c879a061"),
  UNSPLASH("1566073771259-6a8506099945"),
  UNSPLASH("1445019980597-93fa8acb246c"),
  UNSPLASH("1611892440504-42a792e24d32"),
  UNSPLASH("1578683010236-d716f9a3f461"),
  UNSPLASH("1590490360182-c33d57733427"),
  UNSPLASH("1582719478250-c89cae4dc85b"),
  UNSPLASH("1618773928121-c32242e63f39"),
  UNSPLASH("1560448204-e02f11c3d0e2"),
  UNSPLASH("1499696010180-025ef6e1a8f9"),
  UNSPLASH("1587061949409-02df41d5e562"),
  UNSPLASH("1544161515-4ab6ce6db874"),
  UNSPLASH("1521783988139-89397d761dce"),
  UNSPLASH("1600585154340-be6161a56a0c"),
  UNSPLASH("1505693416388-ac5ce068fe85"),
  UNSPLASH("1522798514-97ceb8c4f1c8"),
  UNSPLASH("1540541338287-41700207dee6"),
];

const RENTAL_IMAGES = [
  UNSPLASH("1551698618-1dfe5d97d256"),
  UNSPLASH("1610478920392-95888b4b7a58"),
  UNSPLASH("1512909006721-3d6018887383"),
  UNSPLASH("1548777123-e216912df7d8"),
  UNSPLASH("1516569422496-9dc4b9b0f5c1"),
  UNSPLASH("1483721310020-03333e577078"),
  UNSPLASH("1605540436563-5bca919ae766"),
  UNSPLASH("1522056615691-da7b8106c665"),
  UNSPLASH("1551524559-8af4e6624178"),
  UNSPLASH("1519315901367-f34ff9154487"),
  UNSPLASH("1516625834306-0b5998c6f6bb"),
  UNSPLASH("1478700485868-972b69dc3fc4"),
  UNSPLASH("1544620347-c4fd4a3d5957"),
  UNSPLASH("1607346256330-dee7af15f7c5"),
  UNSPLASH("1517649763962-0c623066013b"),
  UNSPLASH("1522056615691-da7b8106c665"),
  UNSPLASH("1486078695445-0497c2f58cfe"),
  UNSPLASH("1522163182402-834f871fd851"),
  UNSPLASH("1517825738774-7de9363ef735"),
  UNSPLASH("1502904550040-7534597429ae"),
  UNSPLASH("1454117096348-e4abbeba002c"),
  UNSPLASH("1476900543704-4312b78632f8"),
];

/** Hash stabile per ruotare le immagini in modo deterministico. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Immagine tematica alpina (alloggi) o attrezzatura sci (noleggi). */
export function themedImage(kind: "hotel" | "rental", seed: string): string {
  const set = kind === "hotel" ? HOTEL_IMAGES : RENTAL_IMAGES;
  return set[hash(seed) % set.length]!;
}

/**
 * Immagini per una lista di strutture: stabili per struttura (hash del nome)
 * e mai identiche fra schede adiacenti (in caso di collisione si scorre).
 */
export function themedImages(kind: "hotel" | "rental", seeds: string[]): string[] {
  const set = kind === "hotel" ? HOTEL_IMAGES : RENTAL_IMAGES;
  const used = new Set<number>();
  return seeds.map((seed) => {
    let i = hash(seed) % set.length;
    let guard = 0;
    while (used.has(i) && guard < set.length) {
      i = (i + 1) % set.length;
      guard += 1;
    }
    if (used.size >= set.length) used.clear();
    used.add(i);
    return set[i]!;
  });
}



/* ------------------------------------------------------------------ */
/* Link esterni                                                        */
/* ------------------------------------------------------------------ */

/** Sito ufficiale sanificato, se presente nei tag OSM. */
export function officialSiteUrl(website?: string | null): string | null {
  if (!website || !website.trim()) return null;
  return ensureAbsoluteUrl(website.trim());
}

/** Ricerca Google mirata quando manca il sito ufficiale. */
export function googleSearchUrl(name: string, resortName: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${name} ${resortName} sito ufficiale`,
  )}`;
}

/** Posizione esatta su Google Maps a partire dalle coordinate LocationIQ. */
export function mapCoordsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/** Indicazioni stradali verso le coordinate. */
export function directionsCoordsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
