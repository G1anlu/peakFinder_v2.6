import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NewsList, type NewsItem } from "@/components/ski/NewsList";
import { NewsListSkeleton } from "@/components/ski/Skeletons";
import { fetchStoredNews, refreshNewsFeed } from "@/lib/ski/news-store.functions";
import { supabase } from "@/integrations/supabase/client";

const QUERY_KEY = ["stored-news"];

/**
 * Notizie lette dalla tabella `news`, aggiornate in tempo reale (Realtime)
 * e ricaricabili a mano con il pulsante "Aggiorna notizie".
 */
export function NewsFeedSection({ title = "Ultime notizie dai comprensori" }: { title?: string }) {
  const queryClient = useQueryClient();
  const loadNews = useServerFn(fetchStoredNews);
  const refresh = useServerFn(refreshNewsFeed);
  const [busy, setBusy] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => loadNews({ data: { limit: 60 } }),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (data?.error) toast.error("Notizie non disponibili", { description: data.error });
  }, [data?.error]);

  const news: NewsItem[] = data?.news ?? [];

  const runRefresh = useCallback(
    async (silent = false) => {
      setBusy(true);
      try {
        const res = await refresh({ data: undefined });
        if (res.error) {
          toast.error("Aggiornamento non riuscito", { description: res.error });
        } else if (!silent) {
          toast.success(
            res.inserted > 0
              ? `${res.inserted} nuove notizie aggiunte.`
              : "Nessuna nuova notizia: sei già aggiornato.",
          );
        }
        await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      } catch (err) {
        toast.error("Connessione non riuscita", {
          description: err instanceof Error ? err.message : "Riprova tra poco.",
        });
      } finally {
        setBusy(false);
      }
    },
    [queryClient, refresh],
  );

  // Primo avvio: se l'archivio è vuoto, popolalo subito.
  useEffect(() => {
    if (!isPending && !busy && news.length === 0 && !data?.error) {
      void runRefresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, news.length]);

  // Realtime: nuove notizie inserite → la lista si aggiorna da sola.
  useEffect(() => {
    const channel = supabase
      .channel("news-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "news" }, () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <section className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
        <Button variant="secondary" onClick={() => void runRefresh()} disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
          {busy ? "Aggiorno…" : "Aggiorna notizie"}
        </Button>
      </div>
      <div className="mt-4">
        {isPending || (busy && news.length === 0) ? (
          <NewsListSkeleton count={3} />
        ) : news.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna notizia disponibile. Prova ad aggiornare.
          </p>
        ) : (
          <NewsList news={news} />
        )}
      </div>
    </section>
  );
}
