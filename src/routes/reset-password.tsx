import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nuova password — PeakFinder" },
      {
        name: "description",
        content: "Imposta una nuova password per il tuo account PeakFinder e torna sulla neve.",
      },
      { property: "og:title", content: "Nuova password — PeakFinder" },
      {
        property: "og:description",
        content: "Reimposta la password del tuo account PeakFinder in pochi secondi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Il link di recupero crea una sessione temporanea: attendiamo che sia attiva.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const save = async () => {
    if (password !== confirm) {
      setError("Le due password non coincidono.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => navigate({ to: "/profilo" }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggiornamento non riuscito");
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
          Scegli una nuova password
        </h1>
        {done ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Password aggiornata. Ti portiamo al tuo profilo…
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {ready
                ? "Inserisci la nuova password due volte per conferma."
                : "Apri questa pagina dal link ricevuto per email per poter cambiare la password."}
            </p>
            <div className="mt-6 space-y-3">
              <div>
                <Label htmlFor="password" className="text-sm">
                  Nuova password
                </Label>
                <Input
                  id="password"
                  type="password"
                  className="mt-1"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirm" className="text-sm">
                  Ripeti la password
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  className="mt-1"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                className="w-full"
                onClick={save}
                disabled={busy || !ready || password.length < 6 || confirm.length < 6}
              >
                Salva la nuova password
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
