import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gauge, Mountain, Radar, Route as RouteIcon, Swords, Trophy, Zap } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { usePvpDuel } from "@/hooks/usePvpDuel";
import { ResortLiveMap } from "@/components/ski/ResortLiveMap";

const fmt = (n: number) => new Intl.NumberFormat("it-IT").format(Math.round(n));

/** mm:ss */
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function Metric({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
        {icon} {label}
      </p>
      <p className="font-display text-lg font-semibold text-slate-50">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}


/** Card giocatore: profilo (avatar, nome, ELO) separato dal punteggio live. */
function PlayerCard({
  name,
  avatarUrl = null,
  elo,
  points,
  km,
  highlight = false,
}: {
  name: string;
  avatarUrl?: string | null;
  elo: number | null;
  points: number;
  km: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border bg-background/80 p-3 backdrop-blur ${
        highlight ? "border-lime-400/60" : "border-slate-700"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-800 text-[10px] font-semibold text-lime-300">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`Foto di ${name}`} className="h-full w-full object-cover" />
          ) : (
            name.slice(0, 2).toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-slate-50">{name}</p>
          <p className="truncate text-[10px] text-slate-400">
            {elo != null ? `🏆 ${fmt(elo)} ELO` : "—"}
          </p>
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-2 border-t border-slate-700/60 pt-2">
        <p className="font-display text-lg font-bold text-slate-50">
          {fmt(points)}
          <span className="ml-1 text-[10px] font-normal text-slate-400">pts</span>
        </p>
        <p className="shrink-0 text-[11px] text-slate-400">{km.toFixed(1)} km</p>
      </div>
    </div>
  );
}


/** Dashboard mobile della Sfida PvP: mappa a tutto schermo, HUD e metriche live. */
export function PvpArena() {
  const { isAuthenticated } = useAuth();
  const pvp = usePvpDuel(isAuthenticated);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const { duel, mine, theirs, gps, stats, opponent, result, bonusFlash, waiting, live } = pvp;
  const myPoints = pvp.myPoints;
  const theirPoints = pvp.theirPoints;
  const opponentLabel = opponent?.username ?? "Avversario";
  const diff = Math.round(myPoints - theirPoints);

  // Il popup del bonus scompare da solo dopo 2,5 secondi.
  useEffect(() => {
    if (!bonusFlash) return;
    const id = setTimeout(() => pvp.clearBonusFlash(), 2500);
    return () => clearTimeout(id);
  }, [bonusFlash, pvp]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/70 p-7 text-center">
          <Swords className="mx-auto h-7 w-7 text-lime-400" />
          <h1 className="mt-4 font-display text-xl font-semibold text-slate-50">Sfida PvP</h1>
          <p className="mt-2 text-sm text-slate-400">
            Accedi per entrare nel campo di gara e sfidare uno sciatore del tuo livello.
          </p>
          <Link
            to="/login"
            search={{ next: "/pvp" }}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-4 py-3 font-display text-sm font-semibold text-slate-950"
          >
            Accedi per sfidare
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-0 bg-slate-950">
      <ResortLiveMap
        position={pvp.position}
        lifts={pvp.lifts}
        pistes={pvp.pistes}
        completedLiftIds={pvp.completed}
        track={pvp.gpsPositions}
        className="absolute inset-0 h-screen w-screen"
        mapClassName="h-full w-full"
      />

      {/* Intestazione statistiche: una sola colonna con spaziature fisse, così
          nome, ELO e punteggi non possono mai sovrapporsi tra loro né ai
          controlli della mappa. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 flex flex-col gap-4 p-4">
        {/* Riga 1: stato GPS, cronometro, monete */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold bg-background/80 backdrop-blur ${
                pvp.gpsPermission === "granted"
                  ? "border-lime-400/60 text-lime-300"
                  : "border-orange-500/60 text-orange-300"
              }`}
            >
              {pvp.gpsPermission === "granted"
                ? "📡 GPS Collegato"
                : pvp.gpsPermission === "checking"
                  ? "📡 Collegamento GPS…"
                  : pvp.gpsPermission === "denied"
                    ? "📡 GPS negato"
                    : "📡 GPS non disponibile"}
            </div>
            {pvp.raceSecondsLeft != null && (
              <div className="rounded-xl border border-slate-700 bg-background/80 px-3 py-1.5 font-display text-sm font-semibold text-slate-50 backdrop-blur">
                ⏱ {clock(pvp.raceSecondsLeft)}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-slate-700 bg-background/80 px-3 py-1.5 font-display text-sm font-semibold text-slate-50 backdrop-blur">
            🪙 {fmt(stats?.coins ?? 0)}
          </div>
        </div>

        {/* Riga 2: le due card giocatore, ognuna con profilo e punteggio separati */}
        <div className="grid grid-cols-2 gap-4">
          <PlayerCard
            name="Tu"
            elo={stats?.eloRating ?? null}
            points={myPoints}
            km={mine?.km ?? gps.downhillKm}
            highlight
          />
          <PlayerCard
            name={waiting ? "In attesa…" : opponentLabel}
            avatarUrl={waiting ? null : (opponent?.avatarUrl ?? null)}
            elo={waiting ? null : (opponent?.eloRating ?? null)}
            points={waiting ? 0 : theirPoints}
            km={waiting ? 0 : (theirs?.km ?? 0)}
          />
        </div>

        {/* Riga 3: radar di attesa oppure banner vantaggio, mai insieme */}
        {live && waiting ? (
          <div className="flex justify-center">
            <div className="w-full max-w-xs rounded-2xl border border-sky-500/50 bg-background/80 px-4 py-5 text-center backdrop-blur">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-sky-400/60">
                <span className="absolute inset-0 animate-ping rounded-full border-2 border-sky-400/50" />
                <Radar className="h-7 w-7 animate-pulse text-sky-300" />
              </div>
              <p className="mt-4 font-display text-sm font-semibold text-slate-50">
                Ricerca di un avversario in corso…
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Rimani in attesa sulla mappa: la gara parte appena entra uno sfidante.
              </p>
              {pvp.waitingSecondsLeft != null && (
                <p className="mt-3 font-display text-2xl font-bold text-sky-300">
                  {clock(pvp.waitingSecondsLeft)}
                </p>
              )}
            </div>
          </div>
        ) : live && theirs ? (
          <div className="flex justify-center">
            {diff >= 0 ? (
              <div className="max-w-xs truncate rounded-xl border border-lime-400 bg-background/80 px-3 py-2 text-center text-xs font-semibold text-lime-300 backdrop-blur">
                🚀 Sei in vantaggio (+{fmt(diff)} pts)
              </div>
            ) : (
              <div className="max-w-xs truncate rounded-xl border border-orange-500 bg-background/80 px-3 py-2 text-center text-xs font-semibold text-orange-300 backdrop-blur">
                ⚠️ {opponentLabel} ti ha sorpassato!
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Countdown sincronizzato con il server: 5… 4… 3… 2… 1… VIA! */}
      {pvp.countdownSecondsLeft != null && (
        <div className="absolute inset-0 z-[55] grid place-items-center bg-slate-950/85 px-6 text-center">
          <div>
            <p className="truncate text-sm uppercase tracking-widest text-slate-400">
              Sfida contro {opponentLabel}
            </p>
            <p className="mt-3 font-display text-7xl font-bold text-lime-400 animate-in zoom-in">
              {pvp.countdownSecondsLeft}
            </p>
            <p className="mt-3 text-sm text-slate-300">Preparati a partire!</p>
          </div>
        </div>
      )}


      {/* Popup bonus raccolto */}
      {bonusFlash && (
        <div className="pointer-events-none absolute left-1/2 top-1/3 z-50 -translate-x-1/2 animate-in fade-in zoom-in">
          <div className="rounded-2xl border border-lime-400 bg-slate-900/95 px-6 py-4 font-display text-lg font-bold text-lime-300 shadow-[0_0_30px_rgba(163,230,53,0.5)]">
            +{bonusFlash.points} PUNTI SFIDA!
          </div>
        </div>
      )}

      {/* Bottom sheet metriche live */}
      <div className="absolute inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-slate-800 bg-slate-950/95 px-4 pb-6 pt-4 backdrop-blur">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />
        <div className="grid grid-cols-2 gap-2">
          <Metric
            icon={<Gauge className="h-3 w-3" />}
            label="Velocità"
            value={gps.currentSpeed.toFixed(1)}
            unit={`km/h · max ${gps.maxSpeed.toFixed(0)}`}
          />
          <Metric
            icon={<RouteIcon className="h-3 w-3" />}
            label="Discesa"
            value={gps.downhillKm.toFixed(1)}
            unit="km"
          />
          <Metric
            icon={<Mountain className="h-3 w-3" />}
            label="Dislivello −"
            value={fmt(gps.descentM)}
            unit="m"
          />
          <Metric
            icon={<Zap className="h-3 w-3" />}
            label="Impianti presi"
            value={String(mine?.lifts ?? gps.lifts)}
          />
        </div>

        {pvp.error && <p className="mt-3 text-xs text-red-400">{pvp.error}</p>}

        {!live ? (
          <button
            type="button"
            onClick={() => void pvp.enterDuel()}
            disabled={pvp.busy}
            className="mt-4 w-full rounded-2xl bg-lime-400 py-4 font-display text-base font-bold uppercase tracking-wide text-slate-950 shadow-[0_0_25px_rgba(163,230,53,0.45)] disabled:opacity-60"
          >
            {pvp.busy ? "Cerco un avversario…" : "Inizia Sfida PvP"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (waiting ? void pvp.abandonDuel() : setConfirmAbandon(true))}
            disabled={pvp.busy}
            className="mt-4 w-full rounded-2xl bg-red-600 py-4 font-display text-base font-bold uppercase tracking-wide text-slate-50 disabled:opacity-60"
          >
            {waiting ? "Annulla ricerca" : "Abbandona Sfida"}
          </button>
        )}
        <p className="mt-2 text-center text-[11px] text-slate-500">
          I bonus sulla mappa valgono Punti Sfida. Le Monete spendibili arrivano sul profilo solo se
          vinci il match.
        </p>
      </div>

      <AlertDialog open={confirmAbandon} onOpenChange={setConfirmAbandon}>
        <AlertDialogContent className="border-slate-800 bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-50">Abbandonare la sfida?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Sei sicuro di voler abbandonare? Assegnerà la vittoria automatica al tuo avversario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continua a sciare</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void pvp.abandonDuel()}
              className="bg-red-600 text-slate-50 hover:bg-red-700"
            >
              Abbandona
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nessuno sfidante entro 5 minuti */}
      <AlertDialog open={pvp.searchExpired} onOpenChange={() => pvp.dismissSearchExpired()}>
        <AlertDialogContent className="border-slate-800 bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-50">
              Nessun avversario trovato nelle vicinanze
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Non è entrato nessuno sfidante del tuo livello negli ultimi 5 minuti. Riprova più
              tardi: la ricerca è stata annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => pvp.dismissSearchExpired()}
              className="bg-lime-400 text-slate-950 hover:bg-lime-300"
            >
              Ho capito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {result && (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-slate-950/80 px-6">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center">
            <Trophy
              className={`mx-auto h-8 w-8 ${
                result.outcome === "win"
                  ? "text-lime-400"
                  : result.outcome === "draw"
                    ? "text-sky-300"
                    : "text-orange-400"
              }`}
            />
            <h2 className="mt-3 font-display text-xl font-semibold text-slate-50">
              {result.outcome === "win"
                ? "Hai vinto la Sfida PvP!"
                : result.outcome === "draw"
                  ? "Pareggio perfetto!"
                  : "Sfida PvP persa"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {result.outcome === "win"
                ? "+25 Elo e +100 Monete spendibili sul tuo profilo."
                : result.outcome === "draw"
                  ? "Stesso punteggio: Elo invariato e +50 Monete a testa."
                  : "−15 Elo. Riprova domani con una nuova sfida."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Metric icon={null} label="Elo" value={String(result.stats.eloRating)} />
              <Metric icon={null} label="Monete" value={String(result.stats.coins)} />
            </div>
            <button
              type="button"
              onClick={pvp.dismissResult}
              className="mt-5 w-full rounded-xl bg-lime-400 py-3 font-display text-sm font-semibold text-slate-950"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
