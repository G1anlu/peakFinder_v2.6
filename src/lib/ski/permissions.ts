import { isNativeApp } from "./GpsTracker";

export const ALWAYS_ON_GPS_MESSAGE =
  "Per avviare una sfida devi impostare la posizione su «Sempre» nelle impostazioni dello smartphone: PeakFinder deve leggere il GPS anche a schermo spento e con l'app in tasca.";

export interface PermissionCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Verifica che la localizzazione sia utilizzabile per una sfida.
 * Nell'app installata serve la posizione "Sempre attiva" (background),
 * sul sito web basta il permesso di posizione concesso dal browser.
 */
export async function checkChallengeLocation(): Promise<PermissionCheck> {
  if (isNativeApp()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      let status = await Geolocation.checkPermissions();
      if (status.location !== "granted") {
        status = await Geolocation.requestPermissions();
      }
      const alwaysOn = status.location === "granted" && status.coarseLocation === "granted";
      return alwaysOn ? { ok: true } : { ok: false, reason: ALWAYS_ON_GPS_MESSAGE };
    } catch {
      return { ok: false, reason: ALWAYS_ON_GPS_MESSAGE };
    }
  }

  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { ok: false, reason: "Il GPS non è disponibile su questo dispositivo." };
  }

  try {
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    const state = await perms?.query({ name: "geolocation" as PermissionName });
    if (state?.state === "denied") {
      return {
        ok: false,
        reason:
          "Il browser ha bloccato la posizione: consentila dalle impostazioni del sito per avviare la sfida.",
      };
    }
  } catch {
    /* permessi non interrogabili: proseguiamo, il GPS chiederà da solo */
  }
  return { ok: true };
}

/** Chiede il permesso per le notifiche (locali su app installata, di sistema sul web). */
export async function requestNotificationsPermission(): Promise<PermissionCheck> {
  if (isNativeApp()) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const res = await LocalNotifications.requestPermissions();
      return res.display === "granted"
        ? { ok: true }
        : { ok: false, reason: "Notifiche negate: abilitale nelle impostazioni del telefono." };
    } catch {
      return { ok: false, reason: "Notifiche non disponibili su questo dispositivo." };
    }
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, reason: "Questo browser non supporta le notifiche." };
  }
  if (Notification.permission === "granted") return { ok: true };
  try {
    const res = await Notification.requestPermission();
    return res === "granted"
      ? { ok: true }
      : { ok: false, reason: "Notifiche negate: puoi riattivarle dalle impostazioni del browser." };
  } catch {
    return { ok: false, reason: "Notifiche non disponibili." };
  }
}
