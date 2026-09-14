import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Copyright: non scarichiamo né mostriamo le immagini degli articoli delle
 * testate giornalistiche. Le notizie usano la foto libera del comprensorio
 * (src/lib/ski/news-image.ts) o una card tipografica.
 */

async function fetchText(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PeakFinderBot/1.0)" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}


/* ------------------------------------------------------------------ */
/* Aggregatore RSS multi-fonte                                        */
/* ------------------------------------------------------------------ */

/** `topic: true` = fonte generalista, si tengono solo gli articoli di montagna. */
const FEEDS: Array<{ source: string; url: string; topic?: boolean }> = [
  { source: "NeveItalia", url: "https://www.neveitalia.it/rss.xml" },
  { source: "Sciare Magazine", url: "https://www.sciaremag.it/feed/" },
  { source: "DoveSciare", url: "https://www.dovesciare.it/feed/" },
  { source: "Montagna.tv", url: "https://www.montagna.tv/feed/" },
  { source: "SkiForum", url: "https://www.skiforum.it/feed/" },
  { source: "Neve Appennino", url: "https://www.neveappennino.it/feed/" },
  {
    source: "ANSA Montagna",
    url: "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml",
    topic: true,
  },
  {
    source: "TGCOM24 Viaggi",
    url: "https://www.tgcom24.mediaset.it/rss/viaggi.xml",
    topic: true,
  },
];

const TOPIC_WORDS = [
  "neve",
  "nevicat",
  "sci",
  "sciat",
  "snowboard",
  "montagna",
  "alpi",
  "alpin",
  "dolomiti",
  "appennin",
  "comprensor",
  "impianti di risalita",
  "apertura impianti",
  "funivia",
  "seggiovia",
  "cabinovia",
  "skipass",
  "valanga",
  "valanghe",
  "slavina",
  "ghiacciai",
  "ghiacciaio",
  "rifugio",
  "bollettino",
  "innevament",
  "scialpinis",
  "soccorso alpino",
  "vetta",
  "piste da sci",
];

/** Cronaca generale e politica: fuori tema. */
const OFF_TOPIC_WORDS = [
  "governo",
  "parlament",
  "senato",
  "elezion",
  "premier",
  "ministro",
  "partito",
  "manovra",
  "sindaco",
  "processo",
  "omicid",
  "femminicid",
  "rapina",
  "arrestat",
  "droga",
  "calciomercato",
  "serie a",
  "borsa",
  "guerra",
  "gaza",
  "ucraina",
  "putin",
  "trump",
  "meloni",
  "vaticano",
  "sanremo",
];

const isMountainNews = (item: SkiNewsItem) => {
  const hay = `${item.title} ${item.abstract}`.toLowerCase();
  if (OFF_TOPIC_WORDS.some((w) => hay.includes(w))) return false;
  return TOPIC_WORDS.some((w) => hay.includes(w));
};


export interface SkiNewsItem {
  id: string;
  title: string;
  date: string;
  source: string;
  abstract: string;
  url: string;
  image: string | null;
  resorts: string[];
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;|&apos;|&#39;/g, "'")
    .replace(/&#8230;/g, "…")
    .replace(/&laquo;|&raquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    // seconda passata: alcuni feed (Google News) annidano markup HTML escapato
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m?.[1] ? decode(m[1]) : null;
}


/** Ordinamento cronologico stringente: dalla più recente alla più vecchia. */
export const byDateDesc = (a: { date: string }, b: { date: string }) =>
  new Date(b.date).getTime() - new Date(a.date).getTime();

function parseFeed(xml: string, source: string): SkiNewsItem[] {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  const items: SkiNewsItem[] = [];
  for (const block of blocks.slice(0, 40)) {
    const title = tag(block, "title");
    let url = tag(block, "link");
    if (!url) {
      const alt = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      url = alt?.[1] ?? null;
    }
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    const rawDate =
      tag(block, "pubDate") ?? tag(block, "updated") ?? tag(block, "published") ?? "";
    const parsed = rawDate ? new Date(rawDate) : null;
    const date =
      parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toISOString()
        : new Date().toISOString();
    const abstract = (tag(block, "description") ?? tag(block, "summary") ?? "").slice(0, 260);
    items.push({
      id: `${source}-${url}`,
      title,
      date,
      source,
      abstract,
      url,
      // Mai l'immagine dell'articolo originale: copertina libera lato UI.
      image: null,
      resorts: [],
    });
  }
  return items;
}

let cache: { at: number; items: SkiNewsItem[] } | null = null;
const CACHE_MS = 15 * 60 * 1000;

/**
 * Notizie in tempo reale aggregate dai principali feed di settore.
 * I feed non raggiungibili vengono semplicemente ignorati.
 */
export const fetchSkiNews = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { news: cache.items, error: null as string | null };
  }

  const feeds = await Promise.all(
    FEEDS.map(async (f) => {
      const xml = await fetchText(f.url);
      const parsed = xml ? parseFeed(xml, f.source) : [];
      return f.topic ? parsed.filter(isMountainNews) : parsed;

    }),
  );

  const seen = new Set<string>();
  const items: SkiNewsItem[] = [];
  for (const list of feeds) {
    for (const item of list) {
      const key = item.url.replace(/[?#].*$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  items.sort(byDateDesc);

  // Mappa ogni notizia sui comprensori citati nel titolo/abstract.
  const { RESORT_CATALOG, normalizeName } = await import("./catalog");
  const names = RESORT_CATALOG.map((r) => ({
    name: r.name,
    tokens: normalizeName(r.name)
      .split(" ")
      .filter((t) => t.length >= 5),
  })).filter((n) => n.tokens.length > 0);

  for (const item of items) {
    const haystack = normalizeName(`${item.title} ${item.abstract}`);
    const matched: string[] = [];
    for (const n of names) {
      if (n.tokens.some((t) => haystack.includes(t))) matched.push(n.name);
      if (matched.length >= 3) break;
    }
    item.resorts = matched;
  }

  const limited = items.slice(0, 120);
  cache = { at: Date.now(), items: limited };
  return {
    news: limited,
    error: limited.length === 0 ? "Nessun feed raggiungibile in questo momento." : null,
  };
});

/* ------------------------------------------------------------------ */
/* Notizie locali per comprensorio (Google News RSS)                  */
/* ------------------------------------------------------------------ */

const RESORT_CACHE_MS = 15 * 60 * 1000; // 15 minuti (stale-while-revalidate)
const resortCache = new Map<string, { at: number; items: SkiNewsItem[] }>();

function googleNewsUrl(resortName: string) {
  const q = `${resortName} sci OR impianti OR neve`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=it&gl=IT&ceid=IT:it`;
}

/** Il tag <source> di Google News contiene la testata originale. */
function googleSource(block: string): string | null {
  const m = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
  return m?.[1] ? decode(m[1]) : null;
}

async function newsForResort(resortName: string): Promise<SkiNewsItem[]> {
  const key = resortName.toLowerCase();
  const hit = resortCache.get(key);
  if (hit && Date.now() - hit.at < RESORT_CACHE_MS) return hit.items;

  const xml = await fetchText(googleNewsUrl(resortName), 7000);
  if (!xml) {
    if (hit) return hit.items;
    return [];
  }

  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const parsed = parseFeed(xml, "Google News");
  const items = parsed.map((item, i) => {
    const src = blocks[i] ? googleSource(blocks[i]) : null;
    return {
      ...item,
      source: src ?? "Google News",
      abstract: item.abstract.replace(/\s*&nbsp;\s*/g, " ").slice(0, 220),
      resorts: [resortName],
    };
  });

  items.sort(byDateDesc);
  resortCache.set(key, { at: Date.now(), items });
  return items;
}

/** Notizie locali di un singolo comprensorio. */
export const fetchResortNews = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ resortName: z.string().min(2).max(120), limit: z.number().min(1).max(20).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const items = [...(await newsForResort(data.resortName))].sort(byDateDesc);
    return { news: items.slice(0, data.limit ?? 5) };
  });

/** Comprensori di riferimento per la sezione notizie in homepage. */
export const HEADLINE_RESORTS = [
  "Dolomiti Superski",
  "Breuil-Cervinia",
  "Bormio",
  "Courmayeur",
  "Madonna di Campiglio",
];

/** Notizie aggregate dei comprensori principali, per la homepage. */
export const fetchHeadlineResortNews = createServerFn({ method: "GET" }).handler(async () => {
  const lists = await Promise.all(
    HEADLINE_RESORTS.map(async (name) => (await newsForResort(name)).slice(0, 3)),
  );
  const seen = new Set<string>();
  const items: SkiNewsItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      const k = item.url.replace(/[?#].*$/, "");
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(item);
    }
  }
  items.sort(byDateDesc);
  return { news: items.slice(0, 15) };
});
