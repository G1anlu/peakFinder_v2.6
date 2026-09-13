import { Link } from "@tanstack/react-router";
import { Coins, Mountain, Snowflake, Swords, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePvpDuel } from "@/hooks/usePvpDuel";
import { ResortLiveMap } from "@/components/ski/ResortLiveMap";
import { PvpHud } from "@/components/ski/PvpHud";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

/** Dashboard della Sfida PvP: abbinamento, scontro live e risultato finale. */
export function PvpDuelPanel() {
  const { isAuthenticated, username } = useAuth();
  const pvp = usePvpDuel(isAuthenticated);

  if (!isAuthenticated) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <Swords className="h-5 w-5 text-primary" /> Sfida PvP
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sfida un altro sciatore del tuo livello: vince chi accumula più km in discesa, impianti e
          velocità media nella giornata.
        </p>
        <Button asChild className="mt-4">
          <Link to="/login" search={{ next: "/pvp" }}>
            Accedi per sfidare
          </Link>
        </Button>
      </section>
    );
  }

  const { duel, mine, theirs, gps, stats, opponent, result } = pvp;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
          <Swords className="h-5 w-5 text-primary" /> Sfida PvP
        </h2>
        {stats && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Elo {stats.eloRating}
            </span>
            <span className="flex items-center gap-1">
              <Coins className="h-4 w-4" /> {stats.coins} Monete
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-4 w-4" /> {stats.wins}V · {stats.losses}S
            </span>
          </div>
        )}
      </div>

      {pvp.error && <p className="mt-3 text-sm text-destructive">{pvp.error}</p>}

      {pvp.searchExpired && (
        <p className="mt-3 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          Nessun avversario trovato nelle vicinanze negli ultimi 5 minuti: la ricerca è stata
          annullata.
        </p>
      )}

      {pvp.countdownSecondsLeft != null && (
        <p className="mt-3 font-display text-lg font-semibold text-primary">
          La sfida parte in {pvp.countdownSecondsLeft}…
        </p>
      )}

      {!duel || duel.status === "completed" || duel.status === "cancelled" ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Ogni giorno puoi affrontare uno sciatore con punteggio simile al tuo. Il GPS conta solo
            i chilometri in discesa: le risalite in impianto valgono punti a parte.
          </p>
          <Button className="mt-4" onClick={() => void pvp.enterDuel()} disabled={pvp.busy}>
            {pvp.busy ? "Cerco un avversario…" : "Entra in una Sfida PvP"}
          </Button>
        </div>
      ) : duel.status === "waiting" ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-center">
          <Snowflake className="mx-auto h-6 w-6 animate-pulse text-primary" />
          <p className="mt-2 text-sm font-medium text-foreground">In attesa di un avversario…</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ti abbineremo a uno sciatore con Elo entro ±150 punti. Se non entra nessuno entro 5
            minuti la ricerca si annulla.
          </p>
          {pvp.waitingSecondsLeft != null && (
            <p className="mt-2 font-display text-lg font-semibold text-foreground">
              {Math.floor(pvp.waitingSecondsLeft / 60)}:
              {String(pvp.waitingSecondsLeft % 60).padStart(2, "0")}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <Badge>Sfida PvP in Corso</Badge>
            {pvp.raceSecondsLeft != null && (
              <span className="font-display text-sm font-semibold text-foreground">
                ⏱ {Math.floor(pvp.raceSecondsLeft / 60)}:
                {String(pvp.raceSecondsLeft % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
              <p className="font-display font-semibold text-foreground">Tu ({username})</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Km discesa" value={(mine?.km ?? gps.downhillKm).toFixed(1)} />
                <Stat label="Impianti" value={String(mine?.lifts ?? gps.lifts)} />
                <Stat label="Punti Sfida" value={String(Math.round(mine?.score ?? gps.score))} />
              </div>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="font-display font-semibold text-foreground">
                {opponent?.username ?? "Avversario"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Km discesa" value={(theirs?.km ?? 0).toFixed(1)} />
                <Stat label="Impianti" value={String(theirs?.lifts ?? 0)} />
                <Stat label="Punti Sfida" value={String(Math.round(theirs?.score ?? 0))} />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <ResortLiveMap
              position={pvp.position}
              lifts={pvp.lifts}
              pistes={pvp.pistes}
              completedLiftIds={pvp.completed}
              overlay={
                <PvpHud
                  myPoints={mine?.score ?? gps.score}
                  opponentPoints={theirs?.score ?? 0}
                  opponentName={opponent?.username ?? null}
                  coins={stats?.coins ?? 0}
                />
              }
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Piste colorate per difficoltà (verde, blu, rossa, nera) e impianti in blu. I tracciati
              arancioni con ⭐ nascondono un Bonus Sfida: arriva alla stazione di monte per +100
              Punti Sfida (e un obiettivo giornaliero da 50 Monete spendibili).
            </p>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Mountain className="h-4 w-4" />
            GPS {pvp.tracking ? "attivo" : "in pausa"} ·{" "}
            {gps.mode === "downhill"
              ? "discesa in corso"
              : gps.mode === "lift"
                ? "risalita in impianto"
                : "in attesa di movimento"}{" "}
            · velocità media discesa {gps.avgDownhillSpeed} km/h
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!pvp.tracking && (
              <Button variant="secondary" onClick={pvp.startTracking}>
                Riattiva GPS
              </Button>
            )}
            <Button onClick={() => void pvp.closeDuel()} disabled={pvp.busy}>
              Chiudi la giornata
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center">
            <Trophy className="mx-auto h-8 w-8 text-primary" />
            <h3 className="mt-3 font-display text-xl font-semibold text-foreground">
              {result.outcome === "win"
                ? "Hai vinto la Sfida PvP!"
                : result.outcome === "draw"
                  ? "Pareggio perfetto!"
                  : "Sfida PvP persa"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.outcome === "win"
                ? "+25 Elo · +100 Monete spendibili"
                : result.outcome === "draw"
                  ? "Elo invariato · +50 Monete a testa"
                  : "−15 Elo · nessuna moneta"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Nuovo Elo" value={String(result.stats.eloRating)} />
              <Stat label="Monete" value={String(result.stats.coins)} />
            </div>
            <Button className="mt-5 w-full" onClick={pvp.dismissResult}>
              Chiudi
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
