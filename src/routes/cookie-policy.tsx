import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { clearConsent } from "@/lib/consent";

export const Route = createFileRoute("/cookie-policy")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — PeakFinder" },
      {
        name: "description",
        content:
          "Quali cookie e servizi esterni usa PeakFinder: sessione di accesso, statistiche, mappe OpenStreetMap e ricerca hotel, e come cambiare il consenso.",
      },
      { property: "og:title", content: "Cookie Policy — PeakFinder" },
      {
        property: "og:description",
        content: "Elenco dei cookie usati da PeakFinder e gestione del consenso.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CookiePolicyPage,
});

const ROWS = [
  {
    name: "Sessione di accesso (Lovable Cloud / Supabase Auth)",
    type: "Tecnico necessario",
    purpose: "Mantiene l'utente autenticato e protegge il modulo di accesso.",
    duration: "Durata della sessione, rinnovata a ogni accesso",
  },
  {
    name: "Preferenze locali (consenso cookie, onboarding)",
    type: "Tecnico necessario",
    purpose: "Ricorda la scelta sui cookie e lo stato del primo avvio.",
    duration: "Fino a 12 mesi o cancellazione manuale",
  },
  {
    name: "Statistiche di utilizzo (Vercel Analytics)",
    type: "Statistico — richiede consenso",
    purpose: "Misura aggregata delle pagine viste, senza profilazione pubblicitaria.",
    duration: "Fino a 12 mesi",
  },
  {
    name: "Tile di mappa Leaflet / OpenStreetMap",
    type: "Contenuto esterno — richiede consenso",
    purpose: "Caricamento delle mappe dei comprensori dai server OpenStreetMap.",
    duration: "Cache del browser",
  },
  {
    name: "Ricerca hotel e servizi (RapidAPI, LocationIQ, webcam)",
    type: "Contenuto esterno — richiede consenso",
    purpose: "Chiamate ai servizi che restituiscono hotel, luoghi vicini e webcam live.",
    duration: "Durata della richiesta",
  },
];

function CookiePolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold text-foreground">Cookie Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        I cookie tecnici sono indispensabili al funzionamento del sito. Statistiche e contenuti
        esterni vengono caricati solo dopo il tuo consenso esplicito.
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Elenco dei cookie e servizi usati da PeakFinder</caption>
          <thead>
            <tr className="border-b border-border text-foreground">
              <th scope="col" className="py-2 pr-4 font-semibold">Servizio</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Categoria</th>
              <th scope="col" className="py-2 pr-4 font-semibold">Finalità</th>
              <th scope="col" className="py-2 font-semibold">Durata</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {ROWS.map((r) => (
              <tr key={r.name} className="border-b border-border/60 align-top">
                <th scope="row" className="py-3 pr-4 font-medium text-foreground">
                  {r.name}
                </th>
                <td className="py-3 pr-4">{r.type}</td>
                <td className="py-3 pr-4">{r.purpose}</td>
                <td className="py-3">{r.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Gestire il consenso
        </h2>
        <p className="text-sm text-muted-foreground">
          Puoi cambiare idea in qualsiasi momento: il banner riapparirà e potrai scegliere di
          nuovo fra <em>Accetta tutti</em>, <em>Solo tecnici</em> e <em>Personalizza</em>.
        </p>
        <Button
          variant="secondary"
          onClick={clearConsent}
          aria-label="Riapri il banner delle preferenze cookie"
        >
          Rivedi le preferenze cookie
        </Button>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Fonti dei dati</h2>
        <p className="text-sm text-muted-foreground">
          Dati sugli impianti forniti da OpenStreetMap (licenza ODbL 1.0) e Open-Meteo.
        </p>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        Vedi anche la{" "}
        <Link to="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
