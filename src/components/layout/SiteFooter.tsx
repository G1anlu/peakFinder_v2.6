import { Link } from "@tanstack/react-router";
import { clearConsent } from "@/lib/consent";

/** Footer con attribuzioni obbligatorie e collegamenti legali. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/60 px-5 py-8">
      <div className="mx-auto max-w-5xl space-y-3 text-sm text-muted-foreground">
        <nav aria-label="Informazioni legali" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link to="/privacy" className="underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="underline-offset-2 hover:underline">
            Termini e Condizioni
          </Link>
          <Link to="/cookie-policy" className="underline-offset-2 hover:underline">
            Cookie Policy
          </Link>
          <button
            type="button"
            onClick={clearConsent}
            className="underline-offset-2 hover:underline"
            aria-label="Rivedi le preferenze sui cookie"
          >
            Preferenze cookie
          </button>
        </nav>
        <p>
          Dati sugli impianti forniti da OpenStreetMap (licenza ODbL 1.0) e Open-Meteo.
        </p>
        <p>
          PeakFinder è una piattaforma informativa: non vende skipass, biglietti o servizi
          turistici e non gestisce pagamenti o prenotazioni dirette.
        </p>
      </div>
    </footer>
  );
}
