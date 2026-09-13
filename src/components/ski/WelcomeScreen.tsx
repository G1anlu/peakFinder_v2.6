import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Compass, MapPlus, Snowflake, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const GUEST_KEY = "peakfinder.guest.v1";

/**
 * Schermata di benvenuto al primo accesso: si può accedere/registrarsi
 * oppure continuare come ospite (flag salvato in localStorage).
 */
export function WelcomeGate() {
  const { isAuthenticated, loading } = useAuth();
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(true);

  useEffect(() => {
    try {
      setGuest(window.localStorage.getItem(GUEST_KEY) === "1");
    } catch {
      setGuest(true);
    }
    setReady(true);
  }, []);

  if (!ready || loading || isAuthenticated || guest) return null;

  const continueAsGuest = () => {
    try {
      window.localStorage.setItem(GUEST_KEY, "1");
    } catch {
      /* storage non disponibile: si prosegue comunque */
    }
    setGuest(true);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/90 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-xl">
        <div className="flex items-center gap-2 text-primary">
          <Snowflake className="h-6 w-6" />
          <span className="font-display text-xl font-semibold text-foreground">PeakFinder</span>
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
          Benvenuto sulla neve
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Trova il comprensorio giusto per la tua giornata: ore reali sugli sci, meteo, code,
          parcheggi e costo totale del viaggio.
        </p>

        <ul className="mt-5 space-y-2 text-sm text-foreground">
          <li className="flex items-center gap-2">
            <Compass className="h-4 w-4 shrink-0 text-primary" /> Esplora oltre 100 comprensori
            italiani
          </li>
          <li className="flex items-center gap-2">
            <MapPlus className="h-4 w-4 shrink-0 text-primary" /> Crea e salva i tuoi itinerari
          </li>
          <li className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" /> Notizie e condizioni aggiornate
          </li>
        </ul>

        <div className="mt-7 flex flex-col gap-2">
          <Button asChild size="lg" onClick={continueAsGuest}>
            <Link to="/login" search={{ next: "/profilo" }}>
              Accedi o Registrati
            </Link>
          </Button>
          <Button size="lg" variant="ghost" onClick={continueAsGuest}>
            Continua come Ospite
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Come ospite puoi esplorare l'app e creare itinerari; per salvarli serve un account.
        </p>
      </div>
    </div>
  );
}
