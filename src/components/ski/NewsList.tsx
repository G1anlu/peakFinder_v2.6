import { useRef, useState } from "react";
import { CalendarDays, ExternalLink, Newspaper } from "lucide-react";
import { ensureAbsoluteUrl } from "@/lib/url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo } from "./Photo";
import { resortNewsImage } from "@/lib/ski/news-image";

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  source: string;
  abstract: string;
  url: string;
  image?: string | null;
  resorts?: string[];
}

const INITIAL = 5;
const STEP = 10;

/**
 * Lista notizie con paginazione incrementale (5 all'avvio, +10 a ogni click).
 *
 * Copyright: non mostriamo mai le immagini degli articoli originali. Usiamo la
 * foto libera del comprensorio citato oppure, quando la notizia non è legata a
 * una località, una card tipografica con sfumatura e nome della testata.
 */
export function NewsList({ news }: { news: NewsItem[] }) {
  const [visible, setVisible] = useState(INITIAL);
  const topRef = useRef<HTMLDivElement>(null);

  const showLess = () => {
    setVisible(INITIAL);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Ordinamento cronologico: dalla più recente alla più vecchia.
  const ordered = [...news].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const shown = ordered.slice(0, visible);
  const hasMore = visible < ordered.length;

  return (
    <div>
      <div ref={topRef} className="scroll-mt-24" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((n) => {
          const resort = n.resorts?.[0] ?? null;
          const cover = n.image ?? resortNewsImage(resort, n.id);
          return (
            <article
              key={n.id}
              className="overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
            >
              {cover ? (
                <Photo src={cover} alt={`Panorama di ${resort}`} className="h-36 w-full" />
              ) : (
                <div className="flex h-36 w-full flex-col justify-between bg-gradient-to-br from-primary/80 via-primary/50 to-secondary p-4">
                  <Newspaper
                    className="h-5 w-5 text-primary-foreground/90"
                    aria-hidden
                  />
                  <p className="line-clamp-2 font-display text-sm font-semibold text-primary-foreground">
                    {n.source}
                  </p>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>{new Date(n.date).toLocaleDateString("it-IT")}</span>
                  <span aria-hidden>·</span>
                  <span className="truncate">{n.source}</span>
                </div>
                <h3 className="mt-2 font-display text-base font-semibold text-foreground">
                  {n.title}
                </h3>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{n.abstract}</p>
                {n.resorts && n.resorts.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {n.resorts.map((r) => (
                      <li key={r}>
                        <Badge variant="secondary" className="text-[10px]">
                          {r}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <a
                  href={ensureAbsoluteUrl(n.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Leggi l'articolo <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>
          );
        })}
      </div>

      {(hasMore || visible > INITIAL) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {hasMore && (
            <Button variant="secondary" onClick={() => setVisible((v) => v + STEP)}>
              Mostra altre notizie
            </Button>
          )}
          {visible > INITIAL && (
            <Button variant="outline" onClick={showLess}>
              Mostra meno
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
