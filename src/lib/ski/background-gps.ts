import { Capacitor } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

export type GpsPermission = "granted" | "denied" | "prompt" | "unsupported";

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Chiede i permessi GPS completi (incluso il background se nativo).
 */
export async function requestGpsPermission(): Promise<GpsPermission> {
  if (isNativeApp()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      
      // Request Foreground permission first
      let status = await Geolocation.requestPermissions();
      if (status.location !== "granted") return "denied";

      // Request Background permission if native Android/iOS
      if (Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios") {
        const bgStatus = await Geolocation.checkPermissions();
        if (bgStatus.coarseLocation === "denied" || bgStatus.location === "denied") {
          return "denied";
        }
      }

      return "granted";
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
        distanceFilter: 3, // Invia un punto ogni 3 metri
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
      }
    );

    return {
      stop: async () => {
        try {
          await BackgroundGeolocation.removeWatcher({ id: watcherId });
        } catch {
          /* watcher già rimosso */
        }
      },
    };
  } catch (err) {
    handlers.onError?.("Tracciamento in background non disponibile su questo dispositivo.");
    return null;
  }
}
