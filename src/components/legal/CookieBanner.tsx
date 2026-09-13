import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CONSENT_ALL, CONSENT_MINIMAL, saveConsent, useConsent } from "@/lib/consent";

/** Banner di consenso cookie mostrato alla prima visita. */
export function CookieBanner() {
  const { consent, ready } = useConsent();
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [external, setExternal] = useState(true);

  if (!ready || consent) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Informativa sui cookie"
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-border bg-card/98 backdrop-blur"
    >
      <div className="mx-auto max-w-4xl px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h2 className="font-display text-base font-semibold text-card-foreground">
          Rispettiamo la tua privacy
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Usiamo cookie tecnici necessari al funzionamento del sito. Solo con il tuo consenso
          attiviamo statistiche anonime e contenuti esterni (mappe OpenStreetMap, webcam,
          ricerca hotel). Dettagli nella{" "}
          <Link to="/cookie-policy" className="underline underline-offset-2">
            Cookie Policy
          </Link>{" "}
          e nella{" "}
          <Link to="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>

        {custom && (
          <fieldset className="mt-3 space-y-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">
              Scegli le categorie
            </legend>
            <div className="flex items-start gap-2">
              <Checkbox id="cookie-necessary" checked disabled aria-readonly="true" />
              <Label htmlFor="cookie-necessary" className="text-sm leading-snug">
                Tecnici e di sessione (sempre attivi)
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="cookie-analytics"
                checked={analytics}
                onCheckedChange={(v) => setAnalytics(v === true)}
              />
              <Label htmlFor="cookie-analytics" className="text-sm leading-snug">
                Statistiche di utilizzo anonime
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="cookie-external"
                checked={external}
                onCheckedChange={(v) => setExternal(v === true)}
              />
              <Label htmlFor="cookie-external" className="text-sm leading-snug">
                Contenuti esterni: mappe, webcam e ricerca hotel
              </Label>
            </div>
          </fieldset>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => saveConsent(CONSENT_ALL)}
            aria-label="Accetta tutti i cookie"
          >
            Accetta tutti
          </Button>
          <Button
            variant="secondary"
            onClick={() => saveConsent(CONSENT_MINIMAL)}
            aria-label="Accetta solo i cookie tecnici"
          >
            Solo tecnici
          </Button>
          {custom ? (
            <Button
              variant="outline"
              onClick={() =>
                saveConsent({ necessary: true, analytics, external })
              }
              aria-label="Salva le preferenze cookie selezionate"
            >
              Salva preferenze
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setCustom(true)}
              aria-label="Personalizza le preferenze cookie"
            >
              Personalizza
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
