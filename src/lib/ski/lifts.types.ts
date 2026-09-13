export interface LiftEntry {
  id: number;
  name: string;
  type: string | null;
  active: boolean | null;
  resort: string | null;
  resortName: string | null;
  lat: number;
  lng: number;
  topEle: number | null;
  baseEle: number | null;
  lengthM: number | null;
}

/** Stato operativo dell'impianto. */
export type LiftStatus = "open" | "closed" | "maintenance";

/** Impianto con geometria completa, per la mappa live e il tracciamento GPS. */
export interface LiveLift {
  id: number;
  name: string;
  type: string | null;
  active: boolean;
  /** Stato operativo aggiornato (aperto, chiuso, in manutenzione). */
  status: LiftStatus;
  resortName: string | null;
  /** Polilinea del tracciato [lat, lng]. */
  geometry: Array<[number, number]>;
  base: { lat: number; lng: number; ele: number | null };
  top: { lat: number; lng: number; ele: number | null };
  lengthM: number | null;
  /** Vero se oggi l'impianto nasconde un Bonus Sfida. */
  hasBonus: boolean;
}

export type PisteDifficulty =
  | "novice"
  | "easy"
  | "intermediate"
  | "advanced"
  | "expert"
  | "unknown";

/** Pista da discesa disegnata sulla mappa live. */
export interface PisteLine {
  id: number;
  name: string | null;
  difficulty: PisteDifficulty;
  geometry: Array<[number, number]>;
}
