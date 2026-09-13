/**
 * Gestione del consenso cookie (GDPR).
 * I cookie tecnici sono sempre attivi; statistiche e contenuti esterni
 * (mappe, webcam, API di terze parti) restano bloccati fino al consenso.
 */
import { useEffect, useState } from "react";

export const CONSENT_KEY = "peakfinder.cookie-consent.v1";
export const CONSENT_EVENT = "peakfinder:consent-change";

export interface CookieConsent {
  /** Sempre true: sessione, autenticazione, preferenze essenziali. */
  necessary: true;
  /** Statistiche di utilizzo anonime. */
  analytics: boolean;
  /** Contenuti esterni: tile mappa, webcam, servizi di ricerca hotel. */
  external: boolean;
  updatedAt: string;
}

export const CONSENT_ALL: Omit<CookieConsent, "updatedAt"> = {
  necessary: true,
  analytics: true,
  external: true,
};

export const CONSENT_MINIMAL: Omit<CookieConsent, "updatedAt"> = {
  necessary: true,
  analytics: false,
  external: false,
};

export function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (typeof parsed?.analytics !== "boolean") return null;
    return { ...parsed, necessary: true };
  } catch {
    return null;
  }
}

export function saveConsent(value: Omit<CookieConsent, "updatedAt">): CookieConsent {
  const full: CookieConsent = { ...value, necessary: true, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(full));
  } catch {
    /* storage non disponibile */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
  return full;
}

export function clearConsent() {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* storage non disponibile */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
}

/** Consenso corrente, aggiornato in tempo reale dopo la scelta dell'utente. */
export function useConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setConsent(readConsent());
    sync();
    setReady(true);
    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { consent, ready };
}
