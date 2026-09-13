import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — PeakFinder" },
      {
        name: "description",
        content:
          "Come PeakFinder tratta i tuoi dati: e-mail, username, preferenze di comprensori e itinerari, conservazione minima e nessuna cessione commerciale.",
      },
      { property: "og:title", content: "Privacy Policy — PeakFinder" },
      {
        property: "og:description",
        content: "Informativa privacy di PeakFinder ai sensi del GDPR (UE 2016/679).",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Informativa ai sensi degli artt. 13-14 del Regolamento (UE) 2016/679 (GDPR).
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Titolare del trattamento
        </h2>
        <p className="text-sm text-muted-foreground">
          Il Titolare del trattamento è <strong className="text-foreground">PeakFinder</strong>.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Sede legale: [inserire indirizzo completo]</li>
          <li>Partita IVA / Codice fiscale: [inserire P.IVA]</li>
          <li>E-mail di contatto: [inserire indirizzo e-mail]</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Dati raccolti</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Dati di registrazione:</strong> indirizzo e-mail
            e username, necessari per creare e gestire l'account.
          </li>
          <li>
            <strong className="text-foreground">Preferenze d'uso:</strong> comprensori preferiti,
            itinerari salvati, livello sciistico, località visitate e amicizie fra utenti.
          </li>
          <li>
            <strong className="text-foreground">Dati tecnici:</strong> informazioni di sessione,
            log di sicurezza e dati di navigazione strettamente necessari al servizio.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Finalità e base giuridica
        </h2>
        <p className="text-sm text-muted-foreground">
          I dati sono trattati per erogare il servizio richiesto (esecuzione del contratto,
          art. 6.1.b GDPR), per la sicurezza della piattaforma (legittimo interesse,
          art. 6.1.f) e, per le sole categorie facoltative di cookie, sulla base del tuo
          consenso (art. 6.1.a).
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Conservazione e condivisione
        </h2>
        <p className="text-sm text-muted-foreground">
          Applichiamo il principio di minimizzazione: conserviamo i dati solo per il tempo
          necessario a fornire il servizio e li cancelliamo quando elimini l'account.
          <strong className="text-foreground"> I dati non vengono ceduti né venduti a terzi
          per finalità commerciali.</strong> Alcuni fornitori tecnici (hosting, database,
          servizi di mappa e meteo) li trattano come responsabili, nei limiti necessari al
          funzionamento del sito.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">I tuoi diritti</h2>
        <p className="text-sm text-muted-foreground">
          Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti
          al trattamento, oltre a proporre reclamo al Garante per la protezione dei dati
          personali. Dalla pagina profilo puoi eliminare in autonomia e in modo definitivo
          l'account e tutti i dati collegati.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold text-foreground">Fonti dei dati</h2>
        <p className="text-sm text-muted-foreground">
          Dati sugli impianti forniti da OpenStreetMap (licenza ODbL 1.0) e Open-Meteo.
        </p>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        Vedi anche i{" "}
        <Link to="/terms" className="underline underline-offset-2">
          Termini e Condizioni
        </Link>{" "}
        e la{" "}
        <Link to="/cookie-policy" className="underline underline-offset-2">
          Cookie Policy
        </Link>
        .
      </p>
    </main>
  );
}
