import { useMemo } from "react";
import { ExternalLink, MapPin, Navigation, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  directionsCoordsUrl,
  googleSearchUrl,
  mapCoordsUrl,
  officialSiteUrl,
  themedImages,
} from "@/lib/ski/locationiq";
import { euro, PRICE_ON_REQUEST } from "@/lib/ski/pricing";
import { getRentalAffiliateUrl } from "@/lib/affiliateLinks";
import { bookingHotelUrl } from "@/lib/bookingLinks";
import {
  resolveTier,
  sortByPreference,
  TIER_LABEL,
  TIER_SYMBOL,
  tierFromPreference,
} from "@/lib/ski/tier";
import {
  categoryFromLevel,
  RENTAL_CATEGORY_LABEL,
  RENTAL_ESTIMATE_NOTE,
  rentalInfo,
  sortRentals,
} from "@/lib/ski/rentals";
import type { HotelCategory, SkierLevel } from "@/lib/ski/types";
import type { NearbyPlace } from "@/lib/ski/itinerary.functions";

interface Props {
  title: string;
  icon: React.ReactNode;
  places: NearbyPlace[];
  selected: NearbyPlace | null;
  onSelect: (place: NearbyPlace) => void;
  /** Alloggio o noleggio: cambia stima prezzo e immagini tematiche. */
  kind?: "hotel" | "rental";
  /** Nome del comprensorio, usato nella ricerca Google di fallback. */
  resortName?: string;
  /** Preferenza dell'itinerario: porta in cima la fascia scelta. */
  preference?: HotelCategory | null;
  /** Livello sciatore: definisce la categoria attrezzatura del noleggio. */
  skierLevel?: SkierLevel;
}

/**
 * Riga orizzontale scorrevole di strutture reali provenienti da LocationIQ
 * (OpenStreetMap): immagine tematica, fascia di prezzo, stima costo,
 * indirizzo, sito ufficiale (o ricerca Google) e posizione sulla mappa.
 */
export function PlaceRow({
  title,
  icon,
  places,
  selected,
  onSelect,
  kind = "hotel",
  resortName = "",
  preference = null,
  skierLevel = "intermediate",
}: Props) {
  const category = categoryFromLevel(skierLevel);
  const ordered = useMemo(
    () =>
      kind === "rental"
        ? sortRentals(places, category)
        : sortByPreference(places, tierFromPreference(preference)),
    [places, preference, kind, category],
  );
  const images = useMemo(
    () => themedImages(kind, ordered.map((p) => p.placeId || p.name)),
    [kind, ordered],
  );

  return (
    <section aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
          {icon}
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">Scorri per vedere tutte le proposte</span>
      </div>

      {ordered.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nessun risultato nelle vicinanze.</p>
      ) : (
        <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {ordered.map((place, index) => {
            const isSelected = selected?.placeId === place.placeId;
            // Nessuna stima: mostriamo un importo solo se l'API lo fornisce.
            const realPrice =
              kind === "hotel" &&
              typeof place.pricePerNight === "number" &&
              Number.isFinite(place.pricePerNight) &&
              place.pricePerNight > 0
                ? place.pricePerNight
                : null;
            const rental = kind === "rental" ? rentalInfo(place, category) : null;
            const tier = rental ? rental.tier : resolveTier(place.name, place.pricePerNight);
            const site = officialSiteUrl(place.websiteUri);
            const image = place.photoUrl ?? images[index]!;


            return (
              <li
                key={place.placeId}
                className={`w-64 shrink-0 snap-start overflow-hidden rounded-2xl border bg-background transition-colors ${
                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(place)}
                  className="block w-full text-left"
                  aria-pressed={isSelected}
                >
                  <div className="relative">
                    <img
                      src={image}
                      alt={`${kind === "hotel" ? "Alloggio" : "Noleggio sci"}: ${place.name}`}
                      loading="lazy"
                      className="h-36 w-full object-cover"
                    />
                    <span
                      className="absolute right-2 top-2 rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold text-foreground backdrop-blur-sm"
                      title={`Fascia ${TIER_LABEL[tier]}`}
                    >
                      {TIER_SYMBOL[tier]}
                    </span>
                  </div>
                  <div className="space-y-1.5 p-3">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">
                      {place.name}
                    </p>
                    {rental ? (
                      <>
                        {rental.verified && (
                          <Badge className="text-[10px]">Verificato Partner</Badge>
                        )}
                        <p className="text-sm font-semibold text-primary">
                          {rental.realPrice !== null
                            ? euro(rental.realPrice)
                            : `${euro(rental.estimatedRange!.min)}–${euro(
                                rental.estimatedRange!.max,
                              )}`}
                          <span className="text-xs font-normal text-muted-foreground">
                            {" "}
                            / giorno
                          </span>
                        </p>
                        <p className="text-[10px] leading-snug text-muted-foreground">
                          {rental.verified
                            ? `Listino ${rental.network!.label} · ${RENTAL_CATEGORY_LABEL[category]}`
                            : RENTAL_ESTIMATE_NOTE}
                        </p>
                        {!rental.verified && (place.openingHours || place.phone) && (
                          <p className="text-[10px] leading-snug text-muted-foreground">
                            {[place.openingHours, place.phone].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {typeof place.distanceM === "number" && (
                          <p className="text-[10px] text-muted-foreground">
                            {place.distanceM} m dagli impianti
                          </p>
                        )}
                      </>
                    ) : realPrice !== null ? (
                      <p className="text-sm font-semibold text-primary">
                        {euro(realPrice)}
                        <span className="text-xs font-normal text-muted-foreground"> / notte</span>
                      </p>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        {PRICE_ON_REQUEST}
                      </Badge>
                    )}


                    <p className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span className="line-clamp-2">{place.address}</span>
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      {place.provider === "booking"
                        ? "Booking.com · prezzi reali"
                        : "LocationIQ · OpenStreetMap"}
                    </Badge>
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                  <Button asChild size="sm" variant="secondary" className="flex-1">
                    {kind === "rental" ? (
                      <a
                        href={getRentalAffiliateUrl(place.name, resortName, place.websiteUri)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Prenota noleggio
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    ) : place.provider === "booking" ? (
                      <a
                        href={bookingHotelUrl(place.name, resortName, place.bookingUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Prenota su Booking
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    ) : site ? (
                      <a href={site} target="_blank" rel="noopener noreferrer">
                        Sito ufficiale
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <a
                        href={googleSearchUrl(place.name, resortName)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Cerca su Google
                        <Search className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    )}
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a
                      href={mapCoordsUrl(place.lat, place.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Vedi sulla mappa ${place.name}`}
                      title="Vedi sulla mappa"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a
                      href={directionsCoordsUrl(place.lat, place.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Indicazioni per ${place.name}`}
                      title="Indicazioni stradali"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
