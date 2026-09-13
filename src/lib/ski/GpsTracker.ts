import { LIFT_STATION_RADIUS_M } from "./lift-bonus";

/**
 * GpsTracker — tracciamento GPS della giornata sugli sci (solo lato browser).
 *
 * Distingue le discese reali dalle risalite in impianto:
 *  - Discesa: quota in diminuzione e velocità tra 10 e 75 km/h → i km contano.
 *  - Salita:  quota in aumento → conta un impianto e mette in pausa i km.
 *  - Anti-cheat: oltre 85 km/h il punto viene invalidato.
 *
 * Per la batteria: aggiornamenti solo dopo almeno 10 metri di spostamento
 * oppure ogni 8 secondi.
 */

export interface GpsPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null; // km/h
  isDownhill: boolean;
}

export interface GpsStats {
  /** Km percorsi in discesa (gli unici che danno punteggio). */
  downhillKm: number;
  /** Numero di risalite in impianto rilevate. */
  lifts: number;
  /** Velocità media in discesa (km/h). */
  avgDownhillSpeed: number;
  /** Velocità istantanea rilevata (km/h). */
  currentSpeed: number;
  /** Velocità massima registrata (km/h). */
  maxSpeed: number;
  /** Dislivello negativo accumulato in discesa (m). */
  descentM: number;
  /** Punti Sfida del match (temporanei, si azzerano a fine giornata). */
  score: number;
  /** Punti Sfida ottenuti dai Bonus Sfida raccolti sulla mappa. */
  bonusPoints: number;
  /** Stato corrente rilevato dal GPS. */
  mode: "idle" | "downhill" | "lift";
}

export interface LiftGeometry {
  id: number;
  name: string;
  geometry: Array<[number, number]>;
  base: { lat: number; lng: number };
  top: { lat: number; lng: number };
  hasBonus?: boolean;
  /** Stato operativo: solo "open" assegna bonus. */
  status?: "open" | "closed" | "maintenance";
}

export const MIN_DOWNHILL_KMH = 10;
export const MAX_DOWNHILL_KMH = 75;
export const CHEAT_KMH = 85;
/** Alta reattività in pista: nuovo punto ogni 3 metri o ogni secondo. */
const MIN_DISTANCE_M = 3;
const MIN_INTERVAL_MS = 1000;
const MIN_ALTITUDE_DELTA_M = 3;

/** Punti Sfida assegnati raccogliendo un Bonus Sfida sulla mappa. */
export const BONUS_CHALLENGE_POINTS = 100;

/** Formula punteggio: km discesa ×100 + impianti ×15 + velocità media ×2 + bonus. */
export function pvpScore(stats: {
  downhillKm: number;
  lifts: number;
  avgDownhillSpeed: number;
  bonusPoints?: number;
}) {
  return (
    Math.round(
      (stats.downhillKm * 100 +
        stats.lifts * 15 +
        stats.avgDownhillSpeed * 2 +
        (stats.bonusPoints ?? 0)) *
        100,
    ) / 100
  );
}

const haversineM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Distanza approssimata da una polilinea (in metri). */
function distanceToLineM(p: { lat: number; lng: number }, line: Array<[number, number]>) {
  let min = Infinity;
  for (const [lat, lng] of line) {
    const d = haversineM(p, { lat, lng });
    if (d < min) min = d;
  }
  return min;
}

function distanceMeters(a: GeolocationCoordinates, b: GeolocationCoordinates) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface GpsTrackerOptions {
  onStats: (stats: GpsStats) => void;
  onPoint?: (point: GpsPoint) => void;
  onError?: (message: string) => void;
}

export class GpsTracker {
  private watchId: number | null = null;
  private last: { coords: GeolocationCoordinates; at: number } | null = null;
  private downhillKm = 0;
  private lifts = 0;
  private speedSum = 0;
  private speedCount = 0;
  private mode: GpsStats["mode"] = "idle";
  private liftOpen = false;
  private bonusPoints = 0;
  private currentSpeed = 0;
  private maxSpeed = 0;
  private descentM = 0;

  constructor(private readonly options: GpsTrackerOptions) {}

  /** Aggiunge Punti Sfida (bonus raccolto sulla mappa). */
  addBonusPoints(points: number = BONUS_CHALLENGE_POINTS) {
    this.bonusPoints += Math.max(0, points);
    this.options.onStats(this.stats());
  }

  get supported() {
    return typeof navigator !== "undefined" && "geolocation" in navigator;
  }

  start() {
    if (!this.supported) {
      this.options.onError?.("Il GPS non è disponibile su questo dispositivo.");
      return;
    }
    if (this.watchId !== null) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handle(pos),
      (err) => this.options.onError?.(err.message || "Impossibile leggere la posizione."),
      // Massima precisione e nessuna posizione riciclata dalla cache: servono
      // per seguire i cambi di direzione veloci sugli sci.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  stats(): GpsStats {
    const avg = this.speedCount > 0 ? this.speedSum / this.speedCount : 0;
    return {
      downhillKm: Math.round(this.downhillKm * 1000) / 1000,
      lifts: this.lifts,
      avgDownhillSpeed: Math.round(avg * 10) / 10,
      currentSpeed: Math.round(this.currentSpeed * 10) / 10,
      maxSpeed: Math.round(this.maxSpeed * 10) / 10,
      descentM: Math.round(this.descentM),
      score: pvpScore({
        downhillKm: this.downhillKm,
        lifts: this.lifts,
        avgDownhillSpeed: avg,
        bonusPoints: this.bonusPoints,
      }),
      bonusPoints: this.bonusPoints,
      mode: this.mode,
    };
  }

  /** Elabora una posizione: usato dal GPS reale e dai test simulati. */
  handlePosition(coords: GeolocationCoordinates, timestamp: number) {
    const prev = this.last;
    if (!prev) {
      this.last = { coords, at: timestamp };
      this.options.onStats(this.stats());
      return;
    }

    const meters = distanceMeters(prev.coords, coords);
    const elapsed = timestamp - prev.at;
    if (meters < MIN_DISTANCE_M && elapsed < MIN_INTERVAL_MS) return;

    const seconds = Math.max(elapsed / 1000, 1);
    const kmh =
      coords.speed != null && coords.speed >= 0 ? coords.speed * 3.6 : (meters / seconds) * 3.6;

    this.last = { coords, at: timestamp };

    // Anti-cheat
    if (kmh > CHEAT_KMH) {
      this.currentSpeed = 0;
      this.options.onStats(this.stats());
      return;
    }

    const altDelta =
      prev.coords.altitude != null && coords.altitude != null
        ? coords.altitude - prev.coords.altitude
        : 0;

    this.currentSpeed = kmh;
    if (kmh > this.maxSpeed) this.maxSpeed = kmh;

    let isDownhill = false;
    if (altDelta < -MIN_ALTITUDE_DELTA_M && kmh >= MIN_DOWNHILL_KMH && kmh <= MAX_DOWNHILL_KMH) {
      isDownhill = true;
      this.mode = "downhill";
      this.liftOpen = false;
      this.downhillKm += meters / 1000;
      this.descentM += Math.abs(altDelta);
      this.speedSum += kmh;
      this.speedCount += 1;
    } else if (altDelta > MIN_ALTITUDE_DELTA_M) {
      this.mode = "lift";
      if (!this.liftOpen) {
        this.liftOpen = true;
        this.lifts += 1;
      }
    } else {
      this.mode = "idle";
    }

    this.options.onPoint?.({
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude ?? null,
      speed: Math.round(kmh * 10) / 10,
      isDownhill,
    });
    this.options.onStats(this.stats());
  }

  private handle(pos: GeolocationPosition) {
    this.handlePosition(pos.coords, pos.timestamp);
  }
}

/** Stato di risalita su un singolo impianto. */
interface LiftProgress {
  startedAt: number;
  lastAltitude: number | null;
  climbM: number;
}

const liftProgress = new Map<number, LiftProgress>();
const completedLifts = new Set<number>();

/** Azzera lo stato di riconoscimento impianti (nuova giornata / nuovo test). */
export function resetLiftDetection() {
  liftProgress.clear();
  completedLifts.clear();
}

/** Impianti completati oggi. */
export function completedLiftIds(): number[] {
  return [...completedLifts];
}

/**
 * Riconosce l'uso di un impianto di risalita:
 *  - partenza entro 20 m dalla stazione di valle (`base`);
 *  - risalita lungo la geometria con quota in aumento;
 *  - arrivo entro 20 m dalla stazione di monte (`top`) ⇒ impianto completato.
 * Restituisce l'impianto appena completato, altrimenti null.
 */
export function detectLiftUsage(
  currentGpsPoint: { latitude: number; longitude: number; altitude?: number | null },
  liftsList: LiftGeometry[],
  now: number = Date.now(),
): LiftGeometry | null {
  const here = { lat: currentGpsPoint.latitude, lng: currentGpsPoint.longitude };
  const altitude = currentGpsPoint.altitude ?? null;

  for (const lift of liftsList) {
    if (completedLifts.has(lift.id)) continue;
    const state = liftProgress.get(lift.id);

    if (!state) {
      if (haversineM(here, lift.base) <= LIFT_STATION_RADIUS_M) {
        liftProgress.set(lift.id, { startedAt: now, lastAltitude: altitude, climbM: 0 });
      }
      continue;
    }

    // Fuori dal tracciato per troppo: la risalita non è valida.
    if (distanceToLineM(here, lift.geometry) > 120) {
      liftProgress.delete(lift.id);
      continue;
    }

    if (altitude != null && state.lastAltitude != null && altitude > state.lastAltitude) {
      state.climbM += altitude - state.lastAltitude;
    }
    if (altitude != null) state.lastAltitude = altitude;

    if (haversineM(here, lift.top) <= LIFT_STATION_RADIUS_M) {
      liftProgress.delete(lift.id);
      completedLifts.add(lift.id);
      return lift;
    }
  }
  return null;
}
