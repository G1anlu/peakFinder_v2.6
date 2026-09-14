/**
 * Lettura dei feed RSS/Atom pubblici (niente più scraping HTML).
 * Parser: fast-xml-parser.
 */
import { XMLParser } from "fast-xml-parser";

export interface FeedArticle {
  title: string;
  abstract: string;
  source: string;
  articleUrl: string;
  imageUrl: string | null;
  publishedAt: string;
}

/** Fonti pubbliche: sci, neve, meteo e montagna. */
export const NEWS_FEEDS: Array<{ source: string; url: string; topic?: boolean }> = [
  { source: "NeveItalia", url: "https://www.neveitalia.it/rss.xml" },
  { source: "Sciare Magazine", url: "https://www.sciaremag.it/feed/" },
  { source: "DoveSciare", url: "https://www.dovesciare.it/feed/" },
  { source: "Montagna.tv", url: "https://www.montagna.tv/feed/" },
  { source: "SkiForum", url: "https://www.skiforum.it/feed/" },
  { source: "Neve Appennino", url: "https://www.neveappennino.it/feed/" },
  { source: "3B Meteo Montagna", url: "https://www.3bmeteo.com/rss/ultimissime" , topic: true },
  {
    source: "ANSA Montagna",
    url: "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml",
    topic: true,
  },
];

/** Parole chiave della montagna: meteo, neve, valanghe, impianti, eventi alpini, sicurezza. */
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
  "funivia",
  "seggiovia",
  "cabinovia",
  "skilift",
  "impianti di risalita",
  "apertura impianti",
  "skipass",
  "valanga",
  "valanghe",
  "slavina",
  "ghiacciai",
  "ghiacciaio",
  "rifugio",
  "bollettino",
  "innevament",
  "freeride",
  "scialpinis",
  "soccorso alpino",
  "quota",
  "vetta",
  "piste da sci",
];

/** Cronaca generale e politica: fuori tema per PeakFinder. */
const OFF_TOPIC_WORDS = [
  "governo",
  "parlament",
  "senato",
  "camera dei deputati",
  "elezion",
  "premier",
  "ministro",
  "partito",
  "sondagg",
  "manovra",
  "opposizione",
  "sindaco",
  "processo",
  "omicid",
  "femminicid",
  "rapina",
  "arrestat",
  "spaccio",
  "droga",
  "calciomercato",
  "serie a",
  "borsa",
  "spread",
  "guerra",
  "gaza",
  "ucraina",
  "putin",
  "trump",
  "meloni",
  "papa ",
  "vaticano",
  "sanremo",
  "grande fratello",
];

/** Tiene solo le notizie di montagna, scartando cronaca generale e politica. */
export const isMountainArticle = (a: { title: string; abstract: string }) => {
  const hay = `${a.title} ${a.abstract}`.toLowerCase();
  if (OFF_TOPIC_WORDS.some((w) => hay.includes(w))) return false;
  return TOPIC_WORDS.some((w) => hay.includes(w));
};

const isMountain = (a: FeedArticle) => isMountainArticle(a);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return text(o["#text"] ?? o["@_href"] ?? o["@_url"] ?? "");
  }
  return "";
};

const clean = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;|&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

function pickImage(entry: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    entry["media:content"],
    entry["media:thumbnail"],
    entry["enclosure"],
    entry["image"],
  ];
  for (const c of candidates) {
    const node = Array.isArray(c) ? c[0] : c;
    if (!node) continue;
    const o = node as Record<string, unknown>;
    const url = text(o["@_url"] ?? o["@_href"] ?? o);
    if (/^https?:\/\//i.test(url)) return url;
  }
  const body = text(entry["content:encoded"] ?? entry["description"]);
  const m = body.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] && /^https?:\/\//i.test(m[1]) ? m[1] : null;
}

function pickLink(entry: Record<string, unknown>): string | null {
  const link = entry["link"];
  if (typeof link === "string" && /^https?:\/\//i.test(link)) return link;
  const arr = Array.isArray(link) ? link : [link];
  for (const l of arr) {
    const url = text(l);
    if (/^https?:\/\//i.test(url)) return url;
  }
  const guid = text(entry["guid"]);
  return /^https?:\/\//i.test(guid) ? guid : null;
}

function parseFeed(xml: string, source: string): FeedArticle[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }
  const rss = doc["rss"] as Record<string, unknown> | undefined;
  const channel = rss?.["channel"] as Record<string, unknown> | undefined;
  const feed = doc["feed"] as Record<string, unknown> | undefined;
  const raw = channel?.["item"] ?? feed?.["entry"];
  const entries = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Record<string, unknown>[];

  const out: FeedArticle[] = [];
  for (const entry of entries.slice(0, 40)) {
    const title = clean(text(entry["title"]));
    const articleUrl = pickLink(entry);
    if (!title || !articleUrl) continue;
    const rawDate = text(entry["pubDate"] ?? entry["updated"] ?? entry["published"]);
    const parsed = rawDate ? new Date(rawDate) : null;
    out.push({
      title,
      abstract: clean(text(entry["description"] ?? entry["summary"])).slice(0, 300),
      source,
      articleUrl,
      imageUrl: pickImage(entry),
      publishedAt:
        parsed && !Number.isNaN(parsed.getTime())
          ? parsed.toISOString()
          : new Date().toISOString(),
    });
  }
  return out;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
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

/** Scarica e normalizza tutti i feed configurati, deduplicati per URL. */
export async function collectFeedArticles(): Promise<FeedArticle[]> {
  const lists = await Promise.all(
    NEWS_FEEDS.map(async (f) => {
      const xml = await fetchText(f.url);
      const parsed = xml ? parseFeed(xml, f.source) : [];
      // Filtro montagna su TUTTE le fonti: niente cronaca generale o politica.
      return parsed.filter(isMountain);
    }),
  );

  const seen = new Set<string>();
  const items: FeedArticle[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = item.articleUrl.replace(/[?#].*$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ ...item, articleUrl: key });
    }
  }
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return items.slice(0, 150);
}
