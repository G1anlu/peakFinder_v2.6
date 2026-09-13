import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Notizia come salvata nel database. */
export interface StoredNews {
  id: string;
  title: string;
  abstract: string;
  source: string;
  url: string;
  image: string | null;
  date: string;
  resorts: string[];
}

type NewsRow = {
  id: string;
  title: string;
  abstract: string | null;
  source: string | null;
  article_url: string;
  image_url: string | null;
  published_at: string;
  resorts: string[] | null;
};

const toStored = (r: NewsRow): StoredNews => ({
  id: r.id,
  title: r.title,
  abstract: r.abstract ?? "",
  source: r.source ?? "",
  url: r.article_url,
  image: r.image_url,
  date: r.published_at,
  resorts: r.resorts ?? [],
});

function serverClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    }),
  );
}

/** Lettura pubblica delle notizie salvate. */
export const fetchStoredNews = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().min(1).max(150).optional() }).optional().parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = await serverClient();
    const { data: rows, error } = await supabase
      .from("news")
      .select("id,title,abstract,source,article_url,image_url,published_at,resorts")
      .order("published_at", { ascending: false })
      .limit(data?.limit ?? 60);
    if (error) return { news: [] as StoredNews[], error: error.message };
    return { news: (rows as NewsRow[]).map(toStored), error: null as string | null };
  });

/**
 * Aggiorna la tabella `news` dai feed RSS pubblici.
 * L'inserimento è idempotente: `article_url` è chiave unica.
 */
export const refreshNewsFeed = createServerFn({ method: "POST" }).handler(async () => {
  const { collectFeedArticles } = await import("./news-feed.server");
  const articles = await collectFeedArticles();
  if (articles.length === 0) {
    return { inserted: 0, total: 0, error: "Nessun feed raggiungibile in questo momento." };
  }

  // Comprensori citati nel titolo/abstract.
  const { RESORT_CATALOG, normalizeName } = await import("./catalog");
  const names = RESORT_CATALOG.map((r) => ({
    name: r.name,
    tokens: normalizeName(r.name)
      .split(" ")
      .filter((t) => t.length >= 5),
  })).filter((n) => n.tokens.length > 0);

  const rows = articles.map((a) => {
    const haystack = normalizeName(`${a.title} ${a.abstract}`);
    const resorts: string[] = [];
    for (const n of names) {
      if (n.tokens.some((t) => haystack.includes(t))) resorts.push(n.name);
      if (resorts.length >= 3) break;
    }
    return {
      title: a.title,
      abstract: a.abstract,
      source: a.source,
      article_url: a.articleUrl,
      image_url: a.imageUrl,
      published_at: a.publishedAt,
      resorts,
    };
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inserted, error } = await supabaseAdmin
    .from("news")
    .upsert(rows, { onConflict: "article_url", ignoreDuplicates: true })
    .select("id");

  if (error) return { inserted: 0, total: rows.length, error: error.message };
  return { inserted: inserted?.length ?? 0, total: rows.length, error: null as string | null };
});
