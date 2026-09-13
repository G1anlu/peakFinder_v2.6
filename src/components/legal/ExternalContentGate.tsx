import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { readConsent, saveConsent, useConsent } from "@/lib/consent";

/**
 * Non carica contenuti di terze parti (mappe, webcam, servizi esterni)
 * finché l'utente non ha dato il consenso nella categoria "contenuti esterni".
 */
export function ExternalContentGate({
  children,
  label = "Questo contenuto è fornito da un servizio esterno",
}: {
  children: ReactNode;
  label?: string;
}) {
  const { consent, ready } = useConsent();

  if (!ready) return null;
  if (consent?.external) return <>{children}</>;

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Per mostrarlo serve il tuo consenso ai contenuti esterni.
      </p>
      <Button
        className="mt-4"
        onClick={() => {
          const current = readConsent();
          saveConsent({
            necessary: true,
            analytics: current?.analytics ?? false,
            external: true,
          });
        }}
        aria-label="Attiva i contenuti esterni e carica questo contenuto"
      >
        Attiva contenuti esterni
      </Button>
    </div>
  );
}
