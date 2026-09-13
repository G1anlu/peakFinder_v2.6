import { Capacitor } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

/**
 * Tracciamento GPS in background (solo app nativa Capacitor).
 *
 * Sul web resta attivo il watcher del browser: il plugin nativo serve a
 * continuare a registrare posizioni, km e velocità anche a schermo spento,
 * con la notifica di sistema del servizio in primo piano.
 */

export type GpsPermission = "granted" | "denied" | "prompt" | "unsupported";

export const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/** Chiede subito il permesso di posizione (nativo o browser). */
export async function requestGpsPermission(): Promise<GpsPermission> {
  if (isNativeApp()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const res = await Geolocation.requestPermissions();
      const state = res.location;
      if (state === "granted") return "granted";
      if (state === "denied") return "denied";
      return "prompt";
    } catch {
      return "unsupported";
    }
  }

  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return "unsupported";
  return await new Promise<GpsPermission>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? "denied" : "prompt"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

export interface BackgroundPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null; // m/s
  accuracy: number | null;
  time: number | null;
}

export interface BackgroundWatcher {
  stop: () => Promise<void>;
}

/**
 * Avvia il servizio nativo di tracciamento in background.
 * Restituisce null quando non siamo nell'app nativa.
 */
export async function startBackgroundTracking(handlers: {
  onPoint: (point: BackgroundPoint) => void;
  onError?: (message: string) => void;
}): Promise<BackgroundWatcher | null> {
  if (!isNativeApp()) return null;
  try {
    const { registerPlugin } = await import("@capacitor/core");
    const BackgroundGeolocation =
      registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
    const watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Tracciamento discesa in corso...",
        backgroundTitle: "PeakFinder PvP",
        requestPermissions: true,
        stale: false,
        // Alta reattività in pista: un punto ogni 3 metri, fino a 2 al secondo.
        distanceFilter: 3,
        ...({
          enableHighAccuracy: true,
          interval: 1000,
          fastestInterval: 500,
        } as Record<string, unknown>),
      },
      (location, error) => {
        if (error) {
          handlers.onError?.(error.message ?? "GPS non disponibile.");
          return;
        }
        if (!location) return;
        handlers.onPoint({
          latitude: location.latitude,
          longitude: location.longitude,
          altitude: location.altitude ?? null,
          speed: location.speed ?? null,
          accuracy: location.accuracy ?? null,
          time: location.time ?? null,
        });
      },
    );
    return {
      stop: async () => {
        try {
          await BackgroundGeolocation.removeWatcher({ id: watcherId });
        } catch {
          /* watcher già chiuso */
        }
      },
    };
  } catch {
    handlers.onError?.("Tracciamento in background non disponibile su questo dispositivo.");
    return null;
  }
}
