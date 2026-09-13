import { z } from "zod";

export const authSearchSchema = z.object({
  /** Destinazione post-login: accettiamo i tre nomi usati nell'app. */
  next: z.string().optional(),
  redirectTo: z.string().optional(),
  returnUrl: z.string().optional(),
});

/**
 * Normalizza la destinazione post-login: decodifica in sicurezza (anche se
 * codificata più volte), conserva query annidate e frammento, e accetta solo
 * percorsi interni all'app.
 */
export function safePath(value: string | undefined): string {
  if (!value) return "/profilo";
  let candidate = value;
  for (let i = 0; i < 3; i++) {
    if (!/%[0-9a-f]{2}/i.test(candidate)) break;
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    } catch {
      break;
    }
  }
  candidate = candidate.trim();
  // Solo percorsi interni: niente URL assoluti, protocol-relative o schemi.
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/profilo";
  if (/^\/\\/.test(candidate)) return "/profilo";
  // Evita loop verso le pagine di autenticazione.
  if (candidate.startsWith("/auth")) return "/profilo";
  if (candidate.startsWith("/login")) return "/profilo";
  if (candidate.startsWith("/signup")) return "/profilo";
  return candidate;
}

export const REDIRECT_KEY = "peakfinder.redirect.v1";

export function readStoredRedirect(): string | undefined {
  try {
    return window.localStorage.getItem(REDIRECT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Messaggi di errore chiari per l'utente: i testi originali di Supabase sono
 * in inglese e poco comprensibili (es. "Email signups are disabled").
 */
export function authErrorMessage(err: unknown, mode: "login" | "signup"): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const m = raw.toLowerCase();

  if (m.includes("signups not allowed") || m.includes("signups are disabled")) {
    return "Le registrazioni sono momentaneamente disattivate dall'amministratore. Prova ad accedere se hai già un account.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Esiste già un account con questa email: usa la pagina di accesso, non la registrazione.";
  }
  if (m.includes("invalid login credentials")) {
    return "Email o password non valide.";
  }
  if (m.includes("email not confirmed")) {
    return "Devi prima confermare l'email: apri il link che ti abbiamo inviato.";
  }
  if (m.includes("email rate limit") || m.includes("too many requests")) {
    return "Troppi tentativi ravvicinati. Riprova tra qualche minuto.";
  }
  if (m.includes("password should be at least")) {
    return "La password è troppo corta: usa almeno 6 caratteri.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Connessione non riuscita. Controlla la rete e riprova.";
  }
  return raw || (mode === "login" ? "Accesso non riuscito" : "Registrazione non riuscita");
}
