import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useFavorites, useFavoriteUpdates } from "@/hooks/useFavorites";
import { useFriends } from "@/hooks/useFriends";
import { fetchSkiNews } from "@/lib/ski/news.functions";
import { RESORT_CATALOG, liftStatusForResort } from "@/lib/ski/catalog";

export interface AppNotification {
  id: string;
  kind: "snow" | "weather" | "lifts" | "news" | "friend";
  title: string;
  message: string;
  href: string;
  date: string;
}

/** Orari tipici degli impianti: servono per il preavviso di 10 minuti. */
const OPEN_MINUTES = 9 * 60;
const CLOSE_MINUTES = 16 * 60 + 30;
const SEEN_KEY = "peakfinder.notifications.seen.v1";
const LIFTS_KEY = "peakfinder.lifts.snapshot.v1";

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage non disponibile */
  }
};

/**
 * Cronologia avvisi della campanella: meteo e neve, cambio stato impianti,
 * preavviso 10 minuti prima di apertura/chiusura, notizie sulle località
 * preferite e richieste di amicizia. Gli avvisi nuovi vengono inviati anche
 * come notifica di sistema quando l'utente ha dato il permesso.
 */
export function useNotifications() {
  const { favorites } = useFavorites();
  const { updates } = useFavoriteUpdates();
  const { incoming } = useFriends();
  const loadNews = useServerFn(fetchSkiNews);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const news = useQuery({
    queryKey: ["ski-news"],
    queryFn: () => loadNews(),
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15,
  });

  const notifications = useMemo<AppNotification[]>(() => {
    const now = new Date();
    const list: AppNotification[] = [];
    const iso = now.toISOString();

    for (const u of updates) {
      list.push({
        id: `${u.kind}-${u.resortSlug}-${u.message.slice(0, 24)}`,
        kind: u.kind,
        title: u.resortName,
        message: u.message,
        href: `/localita/${u.resortSlug}`,
        date: iso,
      });
    }

    // Cambio stato impianti + preavviso apertura/chiusura
    const snapshot = typeof window === "undefined" ? {} : readJson<Record<string, number>>(LIFTS_KEY, {});
    const nextSnapshot: Record<string, number> = { ...snapshot };
    const minutes = now.getHours() * 60 + now.getMinutes();

    for (const fav of favorites) {
      const resort = RESORT_CATALOG.find((r) => r.id === fav.resortSlug);
      if (!resort) continue;
      const status = liftStatusForResort(resort);
      const previous = snapshot[fav.resortSlug];
      if (typeof previous === "number" && previous !== status.open) {
        list.push({
          id: `lifts-${fav.resortSlug}-${previous}-${status.open}`,
          kind: "lifts",
          title: fav.resortName,
          message:
            status.open > previous
              ? `Impianti aperti: ${status.open} di ${status.total} (erano ${previous}).`
              : `Impianti chiusi: ora ${status.open} di ${status.total} in funzione.`,
          href: `/localita/${fav.resortSlug}`,
          date: iso,
        });
      }
      nextSnapshot[fav.resortSlug] = status.open;

      const toOpen = OPEN_MINUTES - minutes;
      const toClose = CLOSE_MINUTES - minutes;
      if (toOpen > 0 && toOpen <= 10) {
        list.push({
          id: `pre-open-${fav.resortSlug}-${now.toDateString()}`,
          kind: "lifts",
          title: fav.resortName,
          message: `Gli impianti aprono tra ${toOpen} minuti.`,
          href: `/localita/${fav.resortSlug}`,
          date: iso,
        });
      }
      if (toClose > 0 && toClose <= 10) {
        list.push({
          id: `pre-close-${fav.resortSlug}-${now.toDateString()}`,
          kind: "lifts",
          title: fav.resortName,
          message: `Gli impianti chiudono tra ${toClose} minuti.`,
          href: `/localita/${fav.resortSlug}`,
          date: iso,
        });
      }
    }
    if (typeof window !== "undefined" && favorites.length > 0) writeJson(LIFTS_KEY, nextSnapshot);

    // Notizie che citano una località preferita
    const items = news.data?.news ?? [];
    for (const item of items) {
      const match = favorites.find(
        (f) =>
          item.resorts?.includes(f.resortSlug) ||
          `${item.title} ${item.abstract}`.toLowerCase().includes(f.resortName.toLowerCase()),
      );
      if (!match) continue;
      list.push({
        id: `news-${item.id}`,
        kind: "news",
        title: match.resortName,
        message: item.title,
        href: item.url,
        date: item.date,
      });
    }

    for (const req of incoming) {
      list.push({
        id: `friend-${req.id}`,
        kind: "friend",
        title: "Richiesta di amicizia",
        message: `${req.user.username} vuole essere tuo amico.`,
        href: "/profilo",
        date: req.createdAt,
      });
    }

    return list.slice(0, 40);
    // `tick` forza il ricalcolo dei preavvisi ogni minuto.
     
  }, [updates, favorites, news.data, incoming, tick]);

  // Notifica di sistema per gli avvisi mai visti prima
  useEffect(() => {
    if (typeof window === "undefined" || notifications.length === 0) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const seen = new Set(readJson<string[]>(SEEN_KEY, []));
    const fresh = notifications.filter((n) => !seen.has(n.id));
    if (fresh.length === 0) return;

    void navigator.serviceWorker?.ready.then((reg) => {
      for (const n of fresh.slice(0, 3)) {
        reg.showNotification(`PeakFinder · ${n.title}`, {
          body: n.message,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          data: { url: n.href },
          tag: n.id,
        });
      }
    });
    writeJson(SEEN_KEY, [...seen, ...fresh.map((n) => n.id)].slice(-200));
  }, [notifications]);

  return { notifications };
}

/** Registrazione service worker e richiesta permesso notifiche. */
export function usePushPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  const request = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return { permission, request };
}
