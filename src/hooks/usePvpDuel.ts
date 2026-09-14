import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  abandonPvpDuel,
  cancelPvpSearch,
  finishPvpDuel,
  getPvpState,
  joinPvpDuel,
  pushGpsProgress,
  type PvpDuel,
  type PvpOpponent,
  type PvpStats,
} from "@/lib/ski/pvp.functions";
import {
  GpsTracker,
  completedLiftIds,
  detectLiftUsage,
  resetLiftDetection,
  type GpsStats,
} from "@/lib/ski/GpsTracker";
import { claimLiftBonus, nearbyLiveLifts } from "@/lib/ski/lifts.functions";
import { nearbyPistes } from "@/lib/ski/pistes.functions";
import { BONUS_CHALLENGE_POINTS } from "@/lib/ski/GpsTracker";
import type { LiveLift, PisteLine } from "@/lib/ski/lifts.types";
import {
  isNativeApp,
  requestGpsPermission,
  startBackgroundTracking,
  type BackgroundWatcher,
  type GpsPermission,
} from "@/lib/ski/background-gps";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EMPTY_STATS: GpsStats = {
  downhillKm: 0,
  lifts: 0,
  avgDownhillSpeed: 0,
  currentSpeed: 0,
  maxSpeed: 0,
  descentM: 0,
  score: 0,
  bonusPoints: 0,
  mode: "idle",
};

const NOTIFICATION_TAG = "pvp-status";

/** Tempo massimo di attesa di un avversario. */
export const MATCHMAKING_TIMEOUT_S = 300;
/** Durata massima di una sfida. */
export const DUEL_DURATION_S = 3600;

export type PvpOutcome = "win" | "loss" | "draw";

type WakeLockSentinelLike = { release: () => Promise<void> };

const fmtPts = (n: number) => new Intl.NumberFormat("it-IT").format(Math.round(n));

/** Chiede il permesso per le notifiche di sistema (una volta a sfida). */
async function askNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** Stato completo della Sfida PvP: abbinamento, GPS live e chiusura. */
export function usePvpDuel(enabled: boolean) {
  const loadState = useServerFn(getPvpState);
  const join = useServerFn(joinPvpDuel);
  const push = useServerFn(pushGpsProgress);
  const finish = useServerFn(finishPvpDuel);
  const cancelSearch = useServerFn(cancelPvpSearch);
  const forfeit = useServerFn(abandonPvpDuel);
  const loadLifts = useServerFn(nearbyLiveLifts);
  const loadPistes = useServerFn(nearbyPistes);
  const claimBonus = useServerFn(claimLiftBonus);

  const [duel, setDuel] = useState<PvpDuel | null>(null);
  const [opponent, setOpponent] = useState<PvpOpponent | null>(null);
  const [stats, setStats] = useState<PvpStats | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsStats>(EMPTY_STATS);
  const [gpsPositions, setGpsPositions] = useState<Array<[number, number]>>([]);
  const [tracking, setTracking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    duel: PvpDuel;
    stats: PvpStats;
    outcome: PvpOutcome;
  } | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [bonusFlash, setBonusFlash] = useState<{ points: number; at: number } | null>(null);
  const [lifts, setLifts] = useState<LiveLift[]>([]);
  const [pistes, setPistes] = useState<PisteLine[]>([]);
  const [completed, setCompleted] = useState<number[]>([]);
  const [gpsPermission, setGpsPermission] = useState<GpsPermission | "checking">("checking");
  const [now, setNow] = useState(() => Date.now());
  const [searchExpired, setSearchExpired] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const liftsRef = useRef<LiveLift[]>([]);
  const liftsLoadedAtRef = useRef<{ lat: number; lng: number } | null>(null);
  const trackerRef = useRef<GpsTracker | null>(null);
  const backgroundRef = useRef<BackgroundWatcher | null>(null);
  const duelIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const notificationRef = useRef<Notification | null>(null);
  const notifiedMatchRef = useRef<string | null>(null);
  const waitingSinceRef = useRef<number | null>(null);
  const waitingRef = useRef(false);
  const liveRef = useRef(false);
  const closingRef = useRef(false);

  /** Permesso GPS richiesto subito all'apertura della pagina. */
  useEffect(() => {
    let alive = true;
    void requestGpsPermission().then((state) => {
      if (alive) setGpsPermission(state);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Orologio della sfida: countdown, attesa e tempo di gara. */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /** Tiene acceso lo schermo durante la sfida. */
  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      const nav = navigator as Navigator & {
        wakeLock: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      };
      wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      /* schermo non bloccabile: la sfida continua comunque */
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  /** Notifica persistente con lo stato del duello (vinci/perdi). */
  const showLiveNotification = useCallback(
    (myPoints: number, theirPoints: number, name: string) => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const leading = myPoints >= theirPoints;
      try {
        notificationRef.current = new Notification(
          leading ? "PeakFinder PvP - 🚀 STAI VINCENDO!" : "PeakFinder PvP - ⚠️ STAI PERDENDO!",
          {
            body: `Tu: ${fmtPts(myPoints)} pts | ${name}: ${fmtPts(theirPoints)} pts`,
            tag: NOTIFICATION_TAG,
            silent: true,
            ...({ renotify: false } as Record<string, unknown>),
          },
        );
      } catch {
        /* notifica non disponibile */
      }
    },
    [],
  );

  const closeLiveNotification = useCallback(() => {
    try {
      notificationRef.current?.close();
    } catch {
      /* niente da chiudere */
    }
    notificationRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await loadState({ data: undefined });
      // L'avversario ha abbandonato: la sfida risulta chiusa senza che sia stato io.
      const closedByOther =
        liveRef.current &&
        !closingRef.current &&
        (!res.duel || res.duel.status === "completed" || res.duel.status === "cancelled");
      if (closedByOther) setOpponentLeft(true);
      setDuel(res.duel);
      setOpponent(res.opponent);
      setStats(res.stats);
      setUserId(res.userId);
      duelIdRef.current = res.duel?.id ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di rete.");
    }
  }, [loadState]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  const finished = Boolean(duel && (duel.status === "completed" || duel.status === "cancelled"));

  // Aggiorna i dati dell'avversario durante la sfida.
  useEffect(() => {
    if (!enabled || !duel || finished) return;
    const id = setInterval(() => void refresh(), 20000);
    return () => clearInterval(id);
  }, [enabled, duel, finished, refresh]);

  // Realtime: rileva subito l'ingresso dell'avversario nella sfida.
  useEffect(() => {
    const id = duel?.id;
    if (!enabled || !id || finished) return;
    const channel = supabase
      .channel(`pvp-duel-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pvp_duels", filter: `id=eq.${id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, duel?.id, finished, refresh]);

  // Uscita dalla schermata: fermo il GPS, libero la coda di abbinamento e,
  // se la sfida era in corso, la chiudo assegnando la vittoria all'avversario.
  useEffect(
    () => () => {
      trackerRef.current?.stop();
      void backgroundRef.current?.stop();
      const id = duelIdRef.current;
      if (!id) return;
      if (waitingRef.current) {
        void cancelSearch({ data: { duelId: id } }).catch(() => undefined);
      } else if (liveRef.current) {
        void forfeit({ data: { duelId: id } }).catch(() => undefined);
      }
    },
    [cancelSearch, forfeit],
  );

  /** Carica gli impianti attorno alla posizione (una volta ogni ~3 km). */
  const ensureLifts = useCallback(
    async (lat: number, lng: number) => {
      const prev = liftsLoadedAtRef.current;
      if (prev && Math.abs(prev.lat - lat) < 0.03 && Math.abs(prev.lng - lng) < 0.04) return;
      liftsLoadedAtRef.current = { lat, lng };
      try {
        const res = await loadLifts({ data: { lat, lng, radiusM: 8000 } });
        liftsRef.current = res.lifts;
        setLifts(res.lifts);
      } catch {
        /* mappa senza impianti: nessun blocco */
      }
      try {
        const res = await loadPistes({ data: { lat, lng, radiusM: 8000 } });
        setPistes(res.pistes);
      } catch {
        /* mappa senza piste: nessun blocco */
      }
    },
    [loadLifts, loadPistes],
  );

  const startTracking = useCallback(() => {
    if (trackerRef.current) return;
    const tracker = new GpsTracker({
      onStats: setGps,
      onError: (m) => setError(m),
      // Posizione approssimata immediata: la mappa si centra senza attese.
      onQuickFix: (pos) => setPosition((prev) => prev ?? pos),
      onPoint: (point) => {
        setPosition({ lat: point.latitude, lng: point.longitude });
        setGpsPositions((prev) => [...prev, [point.latitude, point.longitude]]);
        void ensureLifts(point.latitude, point.longitude);
        const lift = detectLiftUsage(point, liftsRef.current);
        if (lift) {
          setCompleted(completedLiftIds());
          if (lift.hasBonus && lift.status === "open") {
            tracker.addBonusPoints(BONUS_CHALLENGE_POINTS);
            setBonusFlash({ points: BONUS_CHALLENGE_POINTS, at: Date.now() });
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
              navigator.vibrate([100, 50, 100]);
            }
            toast.success(`Bonus Sfida su ${lift.name}: +${BONUS_CHALLENGE_POINTS} Punti Sfida!`);
            void claimBonus({ data: { liftId: lift.id, liftName: lift.name } })
              .then((res) => {
                if (res.awarded) {
                  toast.success(`Obiettivo giornaliero: +50 Monete spendibili sul tuo profilo!`);
                  setStats((prev) =>
                    prev && res.coins != null ? { ...prev, coins: res.coins } : prev,
                  );
                }
              })
              .catch(() => undefined);
          }
        }
        const id = duelIdRef.current;
        if (!id) return;
        const s = tracker.stats();
        void push({
          data: {
            duelId: id,
            km: s.downhillKm,
            lifts: s.lifts,
            score: s.score,
            point,
          },
        })
          .then((res) => {
            if (res.duel) setDuel(res.duel);
          })
          .catch(() => undefined);
      },
    });
    trackerRef.current = tracker;
    resetLiftDetection();
    setCompleted([]);
    setGpsPositions([]);

    if (isNativeApp()) {
      // App nativa: servizio di background con notifica di sistema, così il
      // tracciamento continua anche a schermo spento in tasca.
      void startBackgroundTracking({
        onError: (m) => setError(m),
        onPoint: (p) => {
          tracker.handlePosition(
            {
              latitude: p.latitude,
              longitude: p.longitude,
              altitude: p.altitude,
              accuracy: p.accuracy ?? 0,
              altitudeAccuracy: null,
              heading: null,
              speed: p.speed,
            } as GeolocationCoordinates,
            p.time ?? Date.now(),
          );
        },
      }).then((watcher) => {
        backgroundRef.current = watcher;
        if (!watcher) tracker.start();
      });
    } else {
      tracker.start();
    }

    setTracking(true);
    void requestWakeLock();
  }, [push, claimBonus, ensureLifts, requestWakeLock]);

  const stopTracking = useCallback(() => {
    trackerRef.current?.stop();
    trackerRef.current = null;
    void backgroundRef.current?.stop();
    backgroundRef.current = null;
    setTracking(false);
    releaseWakeLock();
  }, [releaseWakeLock]);

  /**
   * Avvio della Sfida PvP: SOLO dal click esplicito sul pulsante.
   * Prima di partire verifica che la posizione sia utilizzabile
   * (nell'app installata serve il permesso "Sempre attiva").
   */
  const enterDuel = useCallback(async () => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    setBusy(true);
    setError(null);
    setSearchExpired(false);
    try {
      const perm = await checkChallengeLocation();
      if (!perm.ok) {
        setError(perm.reason ?? ALWAYS_ON_GPS_MESSAGE);
        return;
      }
      void askNotificationPermission();
      const res = await join({ data: undefined });
      setDuel(res.duel);
      setOpponent(res.opponent);
      duelIdRef.current = res.duel.id;
      waitingSinceRef.current = Date.now();
      void requestWakeLock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Abbinamento non riuscito.");
    } finally {
      setBusy(false);
    }
  }, [join, requestWakeLock]);

  const waiting = Boolean(duel && !finished && (duel.status === "waiting" || !duel.player2Id));
  const live = Boolean(duel && !finished);

  /** Secondi che restano per trovare un avversario. */
  const waitingSecondsLeft = useMemo(() => {
    if (!waiting) return null;
    const since = waitingSinceRef.current ?? now;
    return Math.max(0, MATCHMAKING_TIMEOUT_S - Math.floor((now - since) / 1000));
  }, [waiting, now]);

  useEffect(() => {
    liveRef.current = live && !waiting;
  }, [live, waiting]);

  useEffect(() => {
    waitingRef.current = waiting;
    if (waiting && waitingSinceRef.current == null) waitingSinceRef.current = Date.now();
    if (!waiting) waitingSinceRef.current = null;
  }, [waiting]);

  /** Secondi al via sincronizzato (5… 4… 3… 2… 1… VIA!). */
  const countdownSecondsLeft = useMemo(() => {
    if (!duel?.startTime || finished) return null;
    const left = Math.ceil((new Date(duel.startTime).getTime() - now) / 1000);
    return left > 0 ? left : null;
  }, [duel?.startTime, finished, now]);

  const started = Boolean(duel?.startTime && !finished && countdownSecondsLeft == null);

  /** Secondi rimanenti di gara (max 60 minuti). */
  const raceSecondsLeft = useMemo(() => {
    if (!started || !duel?.startTime) return null;
    const elapsed = Math.floor((now - new Date(duel.startTime).getTime()) / 1000);
    return Math.max(0, DUEL_DURATION_S - elapsed);
  }, [started, duel?.startTime, now]);

  // Avversario trovato: avvisa una sola volta.
  useEffect(() => {
    if (!live || waiting || !duel) return;
    if (notifiedMatchRef.current === duel.id) return;
    notifiedMatchRef.current = duel.id;
    toast.success(`Avversario trovato: ${opponent?.username ?? "Sciatore"}! Preparati…`);
  }, [live, waiting, duel, opponent]);

  // Il tracciamento parte esattamente allo scadere del countdown.
  useEffect(() => {
    if (started && !trackerRef.current) startTracking();
  }, [started, startTracking]);

  const isPlayerOne = Boolean(duel && userId && duel.player1Id === userId);
  const mine = duel ? (isPlayerOne ? duel.player1 : duel.player2) : null;
  const theirs = duel ? (isPlayerOne ? duel.player2 : duel.player1) : null;

  const myPoints = useMemo(() => mine?.score ?? gps.score, [mine, gps.score]);
  const theirPoints = theirs?.score ?? 0;

  // Notifica di sistema aggiornata a ogni cambio punteggio.
  useEffect(() => {
    if (!live || waiting) return;
    showLiveNotification(myPoints, theirPoints, opponent?.username ?? "Avversario");
  }, [live, waiting, myPoints, theirPoints, opponent, showLiveNotification]);

  const resetLocalDuel = useCallback(() => {
    stopTracking();
    closeLiveNotification();
    setDuel(null);
    setGpsPositions([]);
    setGps(EMPTY_STATS);
    setCompleted([]);
    setOpponent(null);
    duelIdRef.current = null;
    notifiedMatchRef.current = null;
    waitingSinceRef.current = null;
  }, [stopTracking, closeLiveNotification]);

  /** Chiude la sfida e mostra vittoria, sconfitta o pareggio. */
  const closeDuel = useCallback(async () => {
    const id = duelIdRef.current;
    if (!id) return;
    setBusy(true);
    closingRef.current = true;
    liveRef.current = false;
    try {
      const res = await finish({ data: { duelId: id } });
      stopTracking();
      closeLiveNotification();
      if (res.duel) {
        const outcome: PvpOutcome = !res.duel.winnerId
          ? "draw"
          : res.duel.winnerId === userId
            ? "win"
            : "loss";
        setDuel(res.duel);
        setResult({ duel: res.duel, stats: res.stats, outcome });
      }
      setStats(res.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chiusura non riuscita.");
    } finally {
      closingRef.current = false;
      setBusy(false);
    }
  }, [finish, stopTracking, closeLiveNotification, userId]);

  // Fine tempo: chiusura automatica della sfida.
  useEffect(() => {
    if (raceSecondsLeft === 0 && !result && !busy) void closeDuel();
  }, [raceSecondsLeft, result, busy, closeDuel]);

  /** Annulla la ricerca dell'avversario. */
  const cancelSearchNow = useCallback(
    async (expired: boolean) => {
      const id = duelIdRef.current;
      if (!id) return;
      setBusy(true);
      try {
        await cancelSearch({ data: { duelId: id } });
        resetLocalDuel();
        if (expired) setSearchExpired(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Annullamento non riuscito.");
      } finally {
        setBusy(false);
      }
    },
    [cancelSearch, resetLocalDuel],
  );

  // Timeout matchmaking: 5 minuti senza avversario ⇒ sfida annullata.
  useEffect(() => {
    if (waitingSecondsLeft === 0 && !busy) void cancelSearchNow(true);
  }, [waitingSecondsLeft, busy, cancelSearchNow]);

  const abandonDuel = useCallback(async () => {
    const id = duelIdRef.current;
    if (!id) return;
    if (waiting) {
      await cancelSearchNow(false);
      return;
    }
    setBusy(true);
    closingRef.current = true;
    liveRef.current = false;
    try {
      const res = await forfeit({ data: { duelId: id } });
      setStats(res.stats);
      resetLocalDuel();
      toast.warning("Hai abbandonato la sfida. La vittoria è stata assegnata al tuo avversario.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Abbandono non riuscito.");
    } finally {
      closingRef.current = false;
      setBusy(false);
    }
  }, [forfeit, resetLocalDuel, waiting, cancelSearchNow]);

  // L'avversario ha abbandonato: libero lo stato di gioco e avviso l'utente.
  useEffect(() => {
    if (!opponentLeft) return;
    setOpponentLeft(false);
    liveRef.current = false;
    resetLocalDuel();
    void refresh();
    toast.success("Il tuo avversario ha abbandonato: la vittoria è tua!");
  }, [opponentLeft, resetLocalDuel, refresh]);

  return {
    duel,
    opponent,
    stats,
    gps,
    gpsPositions,
    position,
    lifts,
    pistes,
    completed,
    mine,
    theirs,
    myPoints,
    theirPoints,
    userId,
    tracking,
    live,
    waiting,
    started,
    countdownSecondsLeft,
    waitingSecondsLeft,
    raceSecondsLeft,
    gpsPermission,
    searchExpired,
    dismissSearchExpired: () => setSearchExpired(false),
    busy,
    error,
    result,
    dismissResult: () => setResult(null),
    bonusFlash,
    clearBonusFlash: () => setBonusFlash(null),
    enterDuel,
    closeDuel,
    abandonDuel,
    startTracking,
    refresh,
  };
}
