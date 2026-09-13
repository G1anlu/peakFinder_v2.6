/**
 * Immagini per le notizie conformi al copyright.
 *
 * Non usiamo MAI le foto degli articoli originali (testate giornalistiche):
 * scaricarle o mostrarle sarebbe una violazione della proprietà intellettuale.
 * Al loro posto associamo alla notizia una foto di montagna con licenza libera
 * Unsplash, scelta in modo deterministico dal nome del comprensorio, così che
 * ogni località abbia sempre la stessa immagine di copertina.
 */

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;

/** Foto sci/neve/montagna con licenza Unsplash (uso libero, anche commerciale). */
const RESORT_IMAGES = [
  UNSPLASH("1551698618-1dfe5d97d256"),
  UNSPLASH("1605540436563-5bca919ae766"),
  UNSPLASH("1522056615691-da7b8106c665"),
  UNSPLASH("1517320964276-a002fa203177"),
  UNSPLASH("1486078695445-0497c2f58cfe"),
  UNSPLASH("1478700485868-972b69dc3fc4"),
  UNSPLASH("1548777123-e216912df7d8"),
];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Copertina della notizia: foto libera del comprensorio citato.
 * Restituisce null quando la notizia non è legata ad alcuna località: in quel
 * caso la UI mostra una card tipografica senza fotografia.
 */
export function resortNewsImage(
  resortName?: string | null,
  variantSeed?: string | null,
): string | null {
  const name = (resortName ?? "").trim();
  if (!name) return null;
  const seed = `${name.toLowerCase()}|${variantSeed ?? ""}`;
  return RESORT_IMAGES[hash(seed) % RESORT_IMAGES.length]!;
}
