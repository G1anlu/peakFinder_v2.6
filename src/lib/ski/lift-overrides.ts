/**
 * Correzioni manuali all'abbinamento impianto → comprensorio del dataset
 * OpenStreetMap: alcuni comprensori distinti vengono accorpati per vicinanza
 * geografica (es. Isolaccia / Valdidentro finita sotto "Bormio - Cima Bianca").
 */
export interface ResortOverride {
  slug: string;
  name: string;
  region: string;
  /** Chilometri di piste dichiarati dal comprensorio. */
  km?: number;
}

const ISOLACCIA: ResortOverride = {
  slug: "isolaccia-cima-piazzi",
  name: "Isolaccia - Cima Piazzi / Valdidentro",
  region: "Lombardia",
  km: 18,
};

/** id impianto OSM → comprensorio corretto. */
export const LIFT_RESORT_OVERRIDES = new Map<number, ResortOverride>([
  [322902734, ISOLACCIA], // Isolaccia - Pian della Mota
  [322910027, ISOLACCIA], // Bambi
  [322910025, ISOLACCIA], // Leprotto
  [42348570, ISOLACCIA], // Palancana
  [255963206, ISOLACCIA], // La Rossa - San Colombano
  [116648681, ISOLACCIA], // Monte Masucco
  [42348569, ISOLACCIA], // Masucco
]);
