/** Tariffa minima giornaliera usata solo sul catalogo statico dei comprensori. */
export const MIN_RENTAL_DAY = 18;

/** Notti effettive di soggiorno (mai zero quando si pernotta). */
export function totalNights(totalDays: number): number {
  return Math.max(1, totalDays - 1);
}

/** Camere necessarie: due ospiti per camera. */
export function roomsFor(totalGuests: number): number {
  return Math.max(1, Math.ceil(Math.max(1, totalGuests) / 2));
}

export interface TripBreakdown {
  travel: number;
  /** Costo alloggio: null quando la struttura non espone una tariffa reale. */
  hotel: number | null;
  /** Costo noleggio: sempre null, i negozi non pubblicano listini via API. */
  rental: number | null;
  skipass: number;
  /** Somma delle sole voci con importo reale confermato. */
  total: number;
  /** Voci senza prezzo reale, da verificare sul sito della struttura. */
  pending: string[];
}

/**
 * Costo del viaggio con soli importi reali: trasporto + skipass + alloggio
 * (solo se l'API ha restituito una tariffa). Le voci senza prezzo reale
 * finiscono in `pending` e non vengono mai stimate.
 */
export function tripBreakdown(params: {
  travel: number;
  skipass: number;
  /** €/notte reale della struttura scelta, oppure null. */
  nightPrice?: number | null;
  totalDays: number;
  /** Ospiti totali (adulti + bambini). Default 1. */
  totalGuests?: number;
  /** Persone che noleggiano l'attrezzatura. Default 0. */
  rentalCount?: number;
  /** true quando l'utente ha scelto un noleggio senza tariffa pubblicata. */
  rentalSelected?: boolean;
}): TripBreakdown {
  const nights = totalNights(params.totalDays);
  const guests = Math.max(1, params.totalGuests ?? 1);
  const round = (n: number) => Math.round(n * 100) / 100;

  const nightPrice =
    typeof params.nightPrice === "number" && Number.isFinite(params.nightPrice) && params.nightPrice > 0
      ? params.nightPrice
      : null;
  const hotel = nightPrice === null ? null : round(nightPrice * nights * roomsFor(guests));

  const travel = round(Math.max(0, params.travel));
  const skipass = round(Math.max(0, params.skipass));

  const pending: string[] = [];
  if (hotel === null) pending.push("Alloggio");
  if (params.rentalSelected || (params.rentalCount ?? 0) > 0) pending.push("Noleggio");

  return {
    travel,
    hotel,
    rental: null,
    skipass,
    total: round(travel + skipass + (hotel ?? 0)),
    pending,
  };
}

export const euro = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(n);

/** Etichetta usata quando l'API non fornisce un prezzo reale. */
export const PRICE_ON_REQUEST = "Prezzo su richiesta";
/** Etichetta usata per i noleggi sci (nessun listino pubblico). */
export const PRICE_CHECK_SITE = "Verifica tariffe sul sito";
