import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import {
  authSearchSchema,
  safePath,
  REDIRECT_KEY,
  readStoredRedirect,
  authErrorMessage,
} from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  validateSearch: authSearchSchema,
  head: () => ({
    meta: [
      { title: "Registrati — PeakFinder" },
      {
        name: "description",
        content:
          "Crea un account PeakFinder per salvare i tuoi itinerari sulla neve, con hotel e noleggio scelti.",
      },
      { property: "og:title", content: "Registrati — PeakFinder" },
      {
        property: "og:description",
        content: "Registrati a PeakFinder e pianifica la tua prossima giornata sulla neve.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { next, redirectTo, returnUrl } = useSearch({ from: "/signup" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
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
    setError(null);
    setInfo(null);

    if (!accepted) {
      setError("Devi accettare la Privacy Policy e i Termini di Servizio.");
      return;
    }


    if (password !== confirmPassword) {
      setError("Le password inserite non coincidono");
      return;
    }

    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${destination}` },
      });
      if (err) throw err;
      setInfo(
        "Account creato. Controlla la tua email per confermare l'account, poi accedi.",
      );
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ href: destination });
    } catch (err) {
      setError(authErrorMessage(err, "signup"));
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
        <h1 className="mt-3 font-display text-2xl font-semibold text-card-foreground">
          Crea il tuo account
        </h1>
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
          <div>
            <Label htmlFor="confirmPassword" className="text-sm">
              Conferma Password
            </Label>
            <PasswordInput
              id="confirmPassword"
              className="mt-1"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="accept-terms"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              aria-required="true"
            />
            <Label htmlFor="accept-terms" className="text-sm leading-snug font-normal">
              Ho letto e accetto la{" "}
              <Link to="/privacy" className="underline underline-offset-2">
                Privacy Policy
              </Link>{" "}
              e i{" "}
              <Link to="/terms" className="underline underline-offset-2">
                Termini di Servizio
              </Link>
              .
            </Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-muted-foreground">{info}</p>}
          <Button
            className="w-full"
            onClick={submit}
            disabled={busy || !email || !password || !confirmPassword || !accepted}
          >
            Registrati
          </Button>
          <Link
            to="/login"
            search={{ next: destination === "/profilo" ? undefined : destination }}
            className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Hai già un account? Accedi
          </Link>
        </div>
      </div>
    </main>
  );
}
