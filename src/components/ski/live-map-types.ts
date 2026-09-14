import type { LiveLift, PisteLine } from "@/lib/ski/lifts.types";

/** Amico presente nella stanza, con la sua posizione in tempo reale. */
export interface FriendPosition {
  id: string;
  username: string;
  lat: number;
  lng: number;
}

/** Proprietà comuni alla mappa live (motore Mapbox oppure OpenTopoMap). */
export interface LiveMapProps {
  /** Posizione GPS corrente dello sciatore. */
  position: { lat: number; lng: number } | null;
  /** Impianti vicini con tracciato e stazioni. */
  lifts: LiveLift[];
  /** Piste da discesa vicine. */
  pistes?: PisteLine[];
  /** Impianti già completati oggi. */
  completedLiftIds?: number[];
  /** Tracciato GPS reale percorso durante la sfida. */
  track?: Array<[number, number]>;
  /** Amici della stanza da mostrare sulla mappa. */
  friends?: FriendPosition[];
  /** Contenuto sovrapposto alla mappa (HUD punteggi). */
  overlay?: React.ReactNode;
  /** Classi del contenitore (per la modalità a tutto schermo). */
  className?: string;
  /** Classi dell'area mappa. */
  mapClassName?: string;
}
