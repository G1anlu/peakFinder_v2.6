import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termini e Condizioni — PeakFinder" },
      {
        name: "description",
        content:
          "Condizioni d'uso di PeakFinder: directory informativa sui comprensori sciistici, senza vendita di skipass, prenotazioni o pagamenti.",
      },
      { property: "og:title", content: "Termini e Condizioni — PeakFinder" },
      {
        property: "og:description",
        content: "Regole d'uso ed esclusione di responsabilità della piattaforma PeakFinder.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Termini e Condizioni
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Condizioni d'uso del servizio PeakFinder.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Esclusione di responsabilità (directory informativa)
        </h2>
        <blockquote className="rounded-xl border-l-4 border-primary bg-secondary/40 p-4 text-sm text-foreground">
          PeakFinder è una piattaforma unicamente informativa. Non vende biglietti, skipass o
          servizi turistici, né gestisce transazioni finanziarie o prenotazioni dirette. Non è
          prevista alcuna politica di rimborso in quanto non viene incassato alcun pagamento
          sul sito.
        </blockquote>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Accuratezza delle informazioni
        </h2>
        <p className="text-sm text-muted-foreground">
          Stime di costi, tempi, stato impianti, meteo e disponibilità derivano da fonti
          pubbliche di terze parti e da calcoli automatici: possono essere incomplete o non
          aggiornate. Verifica sempre le informazioni ufficiali del comprensorio prima di
          metterti in viaggio. PeakFinder non risponde di decisioni prese sulla base dei dati
          pubblicati.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Account e uso</h2>
        <p className="text-sm text-muted-foreground">
          L'account è personale: sei responsabile delle credenziali e dei contenuti che
          inserisci. È vietato l'uso automatizzato massivo del servizio, la raccolta di dati
          di altri utenti e qualsiasi impiego contrario alla legge. Puoi eliminare l'account
          in qualsiasi momento dalla pagina profilo.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Licenze e attribuzioni
        </h2>
        <p className="text-sm text-muted-foreground">
          Dati sugli impianti forniti da OpenStreetMap (licenza ODbL 1.0) e Open-Meteo.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Contatti</h2>
        <p className="text-sm text-muted-foreground">
          Titolare: PeakFinder — [indirizzo], P.IVA [inserire], e-mail [inserire].
        </p>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        Leggi anche la{" "}
        <Link to="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
