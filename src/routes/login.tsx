import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import {
  authSearchSchema,
  safePath,
  REDIRECT_KEY,
  readStoredRedirect,
  authErrorMessage,
} from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: authSearchSchema,
  head: () => ({
    meta: [
      { title: "Accedi — PeakFinder" },
      {
        name: "description",
        content:
          "Accedi a PeakFinder per salvare i tuoi itinerari sulla neve, con hotel e noleggio scelti.",
      },
      { property: "og:title", content: "Accedi — PeakFinder" },
      {
        property: "og:description",
        content: "Entra in PeakFinder e ritrova i tuoi itinerari sulla neve su ogni dispositivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { next, redirectTo, returnUrl } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const destination = safePath(next ?? redirectTo ?? returnUrl);

  /** Se la sessione è già attiva, completa il redirect. */
  useEffect(() => {
    let active = true;
    const finish = (session: unknown) => {
      if (!active || !session) return;
      const stored = readStoredRedirect();
      try {
        window.localStorage.removeItem(REDIRECT_KEY);
      } catch {
        /* storage non disponibile */
      }
      const target = safePath(next ?? redirectTo ?? returnUrl ?? stored);
      navigate({ href: target });
    };
    supabase.auth.getSession().then(({ data }) => finish(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") finish(session);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      // Solo accesso: mai signUp da questo form, per non registrare per errore.
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      navigate({ href: destination });
    } catch (err) {
      setError(authErrorMessage(err, "login"));
    } finally {
      setBusy(false);
    }
  };

  /** Accesso senza password: link magico inviato per email. */
  const magicLink = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${destination}` },
      });
      if (err) throw err;
      setInfo("Ti abbiamo inviato un link di accesso: controlla la tua email.");
    } catch (err) {
      setError(authErrorMessage(err, "login"));
    } finally {
      setBusy(false);
    }
  };

  /** Recupero password: email con link alla pagina di nuova password. */
  const resetPassword = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setInfo("Ti abbiamo inviato l'email per reimpostare la password.");
    } catch (err) {
      setError(authErrorMessage(err, "login"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <Snowflake className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">PeakFinder</span>
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold text-card-foreground">Accedi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Serve per salvare gli itinerari con hotel e noleggio.
        </p>

        <div className="mt-6 space-y-3">
          <div>
            <Label htmlFor="email" className="text-sm">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              className="mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm">
              Password
            </Label>
            <PasswordInput
              id="password"
              className="mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-muted-foreground">{info}</p>}
          <Button className="w-full" onClick={submit} disabled={busy || !email || !password}>
            Accedi
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={magicLink}
            disabled={busy || !email}
          >
            Inviami un link di accesso
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            onClick={resetPassword}
            disabled={busy || !email}
          >
            Password dimenticata?
          </button>
          <Link
            to="/signup"
            search={{ next: destination === "/profilo" ? undefined : destination }}
            className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Non hai un account? Registrati
          </Link>
        </div>
      </div>
    </main>
  );
}
