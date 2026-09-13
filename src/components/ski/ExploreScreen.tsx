import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { CalendarClock, MapPin, Mountain, Search, Snowflake } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewsFeedSection } from "@/components/ski/NewsFeedSection";
import { CATALOG_REGIONS, RESORT_CATALOG, matchesRegion, searchCatalog } from "@/lib/ski/catalog";
import { resortSeason } from "@/lib/ski/season";
import { ResortMap } from "@/components/ski/ResortMap";
import { ExternalContentGate } from "@/components/legal/ExternalContentGate";


const INITIAL_DESTINATIONS = 5;
const DESTINATIONS_STEP = 10;

/** Filtro sui chilometri di piste del comprensorio (non distanza dall'utente). */
type KmFilter = "all" | "10" | "20" | "50" | "100";

const KM_OPTIONS: Array<{ value: KmFilter; label: string }> = [
  { value: "all", label: "Tutti i chilometri di piste" },
  { value: "10", label: "Fino a 10 km di piste" },
  { value: "20", label: "Fino a 20 km di piste" },
  { value: "50", label: "Fino a 50 km di piste" },
  { value: "100", label: "Oltre 100 km di piste" },
];

function matchesKm(totalSkiKm: number, filter: KmFilter): boolean {
  if (filter === "all") return true;
  if (filter === "100") return totalSkiKm > 100;
  return totalSkiKm > 0 && totalSkiKm <= Number(filter);
}

export function ExploreScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("Tutte");
  const [kmFilter, setKmFilter] = useState<KmFilter>("all");
  const [visible, setVisible] = useState(INITIAL_DESTINATIONS);
  const destinationsRef = useRef<HTMLHeadingElement>(null);

  const regions = useMemo(() => ["Tutte", ...CATALOG_REGIONS], []);

  // Ricerca sull'intero dataset impianti-italia.json (nome, regione, impianti).
  const suggestions = useMemo(() => searchCatalog(query, 20), [query]);

  const filtered = useMemo(
    () =>
      RESORT_CATALOG.filter((r) => {
        if (!matchesRegion(r.region, region)) return false;
        if (!matchesKm(r.total_ski_km, kmFilter)) return false;
        return true;
      }),
    [region, kmFilter],
  );

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  const resetPagination = () => setVisible(INITIAL_DESTINATIONS);
  const showLessDestinations = () => {
    setVisible(INITIAL_DESTINATIONS);
    destinationsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header con ricerca */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-5 py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2 text-primary">
              <Snowflake className="h-5 w-5 shrink-0" />
              <span className="truncate font-display text-lg font-semibold text-foreground">
                Esplora la neve
              </span>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link to="/crea-itinerario">Crea itinerario</Link>
            </Button>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca comprensorio, regione o impianto: Cervinia, Plan de Corones…"
              className="pl-9"
              aria-label="Cerca comprensori per nome, regione o impianto"
              type="search"
            />
            {suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
                {suggestions.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        void navigate({ to: "/esplora/$slug", params: { slug: r.id } });
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.region} · {r.total_lifts} impianti
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      {/* News */}
      <NewsFeedSection />

      {/* Destinazioni */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <h2
          ref={destinationsRef}
          className="scroll-mt-24 font-display text-xl font-semibold text-foreground"
        >
          Esplora luoghi e destinazioni
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} comprensori disponibili nel database impianti.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="filtro-nazione"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Nazione
            </label>
            <select
              id="filtro-nazione"
              value="Italia"
              onChange={() => resetPagination()}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="Italia">Italia</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filtro-regione"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Regione
            </label>
            <select
              id="filtro-regione"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                resetPagination();
              }}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r === "Tutte" ? "Tutte le regioni" : r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filtro-km-piste"
              className="block text-xs font-semibold text-muted-foreground"
            >
              Chilometri di piste del comprensorio
            </label>
            <select
              id="filtro-km-piste"
              value={kmFilter}
              onChange={(e) => {
                setKmFilter(e.target.value as KmFilter);
                resetPagination();
              }}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {KM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5">
          <ExternalContentGate label="La mappa usa le tile di OpenStreetMap, un servizio esterno.">
            <ResortMap resorts={filtered} />
          </ExternalContentGate>
          <p className="mt-2 text-xs text-muted-foreground">
            Clicca un marker per vedere nome, stato stagionale e aprire la scheda; doppio click
            apre subito il dettaglio. Dati sugli impianti forniti da OpenStreetMap (licenza
            ODbL 1.0) e Open-Meteo.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const season = resortSeason(r);
            return (
              <Link
                key={r.id}
                to="/esplora/$slug"
                params={{ slug: r.id }}
                className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Mountain className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate font-semibold text-foreground">{r.name}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{r.region}</p>
                <Badge
                  variant={season.open ? "secondary" : "outline"}
                  className="mt-2 gap-1 whitespace-normal text-left"
                >
                  {season.glacier ? (
                    <Snowflake className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {season.badge}
                </Badge>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <dt>Impianti</dt>
                    <dd className="font-semibold text-foreground">{r.total_lifts}</dd>
                  </div>
                  <div>
                    <dt>Km piste</dt>
                    <dd className="font-semibold text-foreground">
                      {r.total_ski_km > 0 ? `${r.total_ski_km} km` : "n.d."}
                    </dd>
                  </div>
                  <div>
                    <dt>Quota</dt>
                    <dd className="font-semibold text-foreground">{r.altitude} m</dd>
                  </div>
                  <div>
                    <dt>Neve</dt>
                    <dd
                      className={
                        season.open
                          ? "font-semibold text-foreground"
                          : "font-medium text-muted-foreground"
                      }
                    >
                      {season.open
                        ? `${r.snowmaking_coverage}% innevamento programmato`
                        : "Dato non disponibile (pausa stagionale)"}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nessun comprensorio con questi filtri.
            </p>
          )}
        </div>


        {(hasMore || visible > INITIAL_DESTINATIONS) && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {hasMore && (
              <Button
                variant="secondary"
                onClick={() => setVisible((v) => v + DESTINATIONS_STEP)}
              >
                Altro
              </Button>
            )}
            {visible > INITIAL_DESTINATIONS && (
              <Button variant="outline" onClick={showLessDestinations}>
                Mostra meno
              </Button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
