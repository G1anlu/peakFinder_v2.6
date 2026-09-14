import { Capacitor } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { LIFT_STATION_RADIUS_M } from "./lift-bonus";

// ==========================================
// INTERFACCE E TIPI
// ==========================================

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

export interface GpsTrackerOptions {
  onStats: (stats: GpsStats) => void;
  onPoint?: (point: GpsPoint) => void;
  /** Posizione approssimata immediata (rete/celle) per centrare subito la mappa. */
  onQuickFix?: (position: { lat: number; lng: number }) => void;
  onError?: (message: string) => void;
}

export type GpsPermission = "granted" | "denied" | "prompt" | "unsupported";

// ==========================================
// COSTANTI E UTILITY
// ==========================================

export const MIN_DOWNHILL_KMH = 10;
export const MAX_DOWNHILL_KMH = 75;
export const CHEAT_KMH = 85;

const MIN_DISTANCE_M = 3;
const MIN_INTERVAL_MS = 1000;
const MIN_ALTITUDE_DELTA_M = 3;

/** Punti Sfida assegnati raccogliendo un Bonus Sfida sulla mappa. */
export const BONUS_CHALLENGE_POINTS = 100;

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

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

function distanceToLineM(p: { lat: number; lng: number }, line: Array<[number, number]>) {
  let min = Infinity;
  for (const [lat, lng] of line) {
    const d = haversineM(p, { lat, lng });
    if (d < min) min = d;
  }
  return min;
}

function distanceBetweenCoords(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  return haversineM(
    { lat: a.latitude, lng: a.longitude },
    { lat: b.latitude, lng: b.longitude }
  );
}

/** Richiede i permessi GPS (inclusi quelli nativi/background se su iOS/Android). */
export async function requestGpsPermission(): Promise<GpsPermission> {
  if (isNativeApp()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const res = await Geolocation.requestPermissions();
      if (res.location === "granted") return "granted";
      if (res.location === "denied") return "denied";
      return "prompt";
    } catch {
      return "unsupported";
    }
  }

  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return "unsupported";
  }

  return new Promise<GpsPermission>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? "denied" : "prompt"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

// ==========================================
// CLASSE GPSTRACKER UNIFICATA
// ==========================================

export class GpsTracker {
  private watchIdNative: string | null = null;
  private watchIdWeb: number | null = null;
  private last: { coords: { latitude: number; longitude: number; altitude: number | null; speed: number | null }; at: number } | null = null;
  
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

  /** Diventa true al primo punto ad alta precisione: da lì il fix rapido non serve più. */
  private hasPreciseFix = false;

  constructor(private readonly options: GpsTrackerOptions) {}

  /**
   * Posizione veloce iniziale: bassa precisione, timeout 3s e cache di 60s,
   * così la mappa si posiziona subito mentre parte il GPS ad alta precisione.
   */
  private async quickFix() {
    const emit = (lat: number, lng: number) => {
      if (this.hasPreciseFix) return;
      this.options.onQuickFix?.({ lat, lng });
    };
    try {
      if (isNativeApp()) {
        const { Geolocation } = await import("@capacitor/geolocation");
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 3000,
          maximumAge: 60000,
        });
        emit(pos.coords.latitude, pos.coords.longitude);
        return;
      }
      if (typeof navigator !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => emit(pos.coords.latitude, pos.coords.longitude),
          () => {
            /* il fix rapido è best effort */
          },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 },
        );
      }
    } catch {
      /* il fix rapido è best effort */
    }
  }

  /** Aggiunge Punti Sfida (bonus raccolto sulla mappa). */
  addBonusPoints(points: number = BONUS_CHALLENGE_POINTS) {
    this.bonusPoints += Math.max(0, points);
    this.options.onStats(this.stats());
  }

  get supported(): boolean {
    return isNativeApp() || (typeof navigator !== "undefined" && "geolocation" in navigator);
  }

  /** Avvia il tracciamento (Nativo in Background o Web standard). */
  async start() {
    if (!this.supported) {
      this.options.onError?.("Il GPS non è disponibile su questo dispositivo.");
      return;
    }

    if (this.watchIdNative !== null || this.watchIdWeb !== null) return;

    // In parallelo al tracciamento preciso: posizione rapida per la mappa.
    void this.quickFix();

    // --- STRADA 1: APP NATIVA (CAPACITOR BACKGROUND) ---
    if (isNativeApp()) {
      try {
        const permResult = await requestGpsPermission();
        if (permResult !== "granted") {
          this.options.onError?.("Permesso GPS negato. Attivalo nelle impostazioni del dispositivo.");
          return;
        }

        const { registerPlugin } = await import("@capacitor/core");
        const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

        this.watchIdNative = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: "Tracciamento discesa in corso...",
            backgroundTitle: "PeakFinder PvP",
            requestPermissions: true,
            stale: false,
            distanceFilter: MIN_DISTANCE_M,
          },
          (location, error) => {
            if (error) {
              this.options.onError?.(error.message ?? "Errore lettura GPS background.");
              return;
            }
            if (!location) return;

            this.handleRawPosition(
              {
                latitude: location.latitude,
                longitude: location.longitude,
                altitude: location.altitude ?? null,
                speed: location.speed ?? null, // m/s dal sensore
              },
              location.time ?? Date.now()
            );
          }
        );
      } catch (err: any) {
        this.options.onError?.("Impossibile avviare il GPS nativo: " + (err.message || err));
      }
    } 
    // --- STRADA 2: BROWSER WEB (FALLBACK) ---
    else {
      this.watchIdWeb = navigator.geolocation.watchPosition(
        (pos) => {
          this.handleRawPosition(
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude ?? null,
              speed: pos.coords.speed ?? null,
            },
            pos.timestamp
          );
        },
        (err) => this.options.onError?.(err.message || "Impossibile leggere la posizione."),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    }
  }

  /** Interrompe il tracciamento. */
  async stop() {
    if (this.watchIdNative !== null) {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
        await BackgroundGeolocation.removeWatcher({ id: this.watchIdNative });
      } catch {
        /* silenziato se il watcher era già stato chiuso */
      }
      this.watchIdNative = null;
    }

    if (this.watchIdWeb !== null) {
      navigator.geolocation.clearWatch(this.watchIdWeb);
      this.watchIdWeb = null;
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

  /** Normalizza l'elaborazione dei punti sia da Web che da Native */
  private handleRawPosition(
    coords: { latitude: number; longitude: number; altitude: number | null; speed: number | null },
    timestamp: number
  ) {
    // Primo punto ad alta precisione: il riposizionamento rapido si disattiva.
    this.hasPreciseFix = true;
    const prev = this.last;
    if (!prev) {
      this.last = { coords, at: timestamp };
      this.options.onStats(this.stats());
      return;
    }

    const meters = distanceBetweenCoords(prev.coords, coords);
    const elapsed = timestamp - prev.at;

    if (meters < MIN_DISTANCE_M && elapsed < MIN_INTERVAL_MS) return;

    const seconds = Math.max(elapsed / 1000, 1);
    
    // Convertiamo la velocità in km/h (il sensore la fornisce in m/s)
    const kmh =
      coords.speed != null && coords.speed >= 0 
        ? coords.speed * 3.6 
        : (meters / seconds) * 3.6;

    this.last = { coords, at: timestamp };

    // Anti-cheat: oltre gli 85 km/h il punto viene scartato
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

    // Discesa
    if (altDelta < -MIN_ALTITUDE_DELTA_M && kmh >= MIN_DOWNHILL_KMH && kmh <= MAX_DOWNHILL_KMH) {
      isDownhill = true;
      this.mode = "downhill";
      this.liftOpen = false;
      this.downhillKm += meters / 1000;
      this.descentM += Math.abs(altDelta);
      this.speedSum += kmh;
      this.speedCount += 1;
    } 
    // Risalita (Impianto)
    else if (altDelta > MIN_ALTITUDE_DELTA_M) {
      this.mode = "lift";
      if (!this.liftOpen) {
        this.liftOpen = true;
        this.lifts += 1;
      }
    } 
    // Fermo / Inattivo
    else {
      this.mode = "idle";
    }

    this.options.onPoint?.({
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude,
      speed: Math.round(kmh * 10) / 10,
      isDownhill,
    });

    this.options.onStats(this.stats());
  }

  /** Compatibilità per test simulati o input manuali */
  handlePosition(coords: GeolocationCoordinates, timestamp: number) {
    this.handleRawPosition(
      {
        latitude: coords.latitude,
        longitude: coords.longitude,
        altitude: coords.altitude ?? null,
        speed: coords.speed ?? null,
      },
      timestamp
    );
  }
}

// ==========================================
// RICONOSCIMENTO IMPIANTI (LIFT DETECTION)
// ==========================================

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
 *  - partenza entro LIFT_STATION_RADIUS_M dalla stazione di valle (`base`);
 *  - risalita lungo la geometria con quota in aumento;
 *  - arrivo entro LIFT_STATION_RADIUS_M dalla stazione di monte (`top`) ⇒ impianto completato.
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
