/**
 * Ricerca hotel con prezzi reali tramite l'API Booking.com su RapidAPI.
 * Nessun prezzo viene inventato: se l'API non fornisce l'importo, il campo
 * resta null e l'interfaccia mostra "Prezzo su richiesta".
 */

const HOST = process.env["RAPIDAPI_HOST"] || "booking-com.p.rapidapi.com";

export interface BookingHotel {
  provider: "booking";
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Prezzo reale per notte in EUR, se fornito dall'API. */
  pricePerNight: number | null;
  currency: string | null;
  photoUrl: string | null;
  bookingUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  distanceM: number | null;
}

const EARTH_M = 6371000;
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s))));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

interface RawHotel {
  hotel_id?: number | string;
  hotel_name?: string;
  hotel_name_trans?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  main_photo_url?: string;
  /** L'API restituisce l'URL diretto con nomi diversi a seconda dell'endpoint. */
  url?: string;
  deep_link?: string;
  canonical_url?: string;
  hotel_url?: string;
  hotel_page_url?: string;
  urls?: { hotel?: string; deep_link?: string };
  review_score?: number;
  review_nr?: number;
  min_total_price?: number;
  currencycode?: string;
  currency_code?: string;

  composite_price_breakdown?: {
    gross_amount?: { value?: number; currency?: string };
    all_inclusive_amount?: { value?: number; currency?: string };
  };
}

/** Hotel reali attorno alle coordinate, ordinati per distanza. */
export async function bookingHotelsByCoordinates(params: {
  lat: number;
  lng: number;
  radiusM: number;
  checkIn?: string | null;
  checkOut?: string | null;
  adults?: number;
}): Promise<{ hotels: BookingHotel[]; error: string | null }> {
  const key = process.env["RAPIDAPI_KEY"];
  if (!key) {
    console.error("[hotels] RAPIDAPI_KEY mancante nell'ambiente del server");
    return { hotels: [], error: "Chiave RapidAPI non configurata sul server." };
  }

  // Date valide: se l'utente non le ha ancora scelte usiamo un soggiorno
  // standard di 2 notti fra un mese, solo per ottenere una tariffa indicativa.
  const now = new Date();
  const fallbackIn = new Date(now.getTime() + 30 * 86_400_000);
  const fallbackOut = new Date(now.getTime() + 32 * 86_400_000);
  const arrival = params.checkIn && params.checkIn >= iso(now) ? params.checkIn : iso(fallbackIn);
  const departure =
    params.checkOut && params.checkOut > arrival ? params.checkOut : iso(fallbackOut);
  const nights = Math.max(
    1,
    Math.round(
      (new Date(departure).getTime() - new Date(arrival).getTime()) / 86_400_000,
    ),
  );

  // Due varianti dell'API Booking su RapidAPI: la nuova (booking-com15) e
  // quella classica (booking-com), con nomi di parametri diversi.
  const isV15 = HOST.startsWith("booking-com15");
  const qs = isV15
    ? new URLSearchParams({
        latitude: String(params.lat),
        longitude: String(params.lng),
        arrival_date: arrival,
        departure_date: departure,
        adults: String(params.adults ?? 2),
        room_qty: "1",
        units: "metric",
        page_number: "1",
        radius: String(Math.round(params.radiusM / 1000)),
        currency_code: "EUR",
        languagecode: "it",
      })
    : new URLSearchParams({
        latitude: String(params.lat),
        longitude: String(params.lng),
        checkin_date: arrival,
        checkout_date: departure,
        adults_number: String(params.adults ?? 2),
        room_number: "1",
        units: "metric",
        page_number: "0",
        order_by: "distance",
        filter_by_currency: "EUR",
        locale: "it",
      });
  const endpoint = isV15
    ? `https://${HOST}/api/v1/hotels/searchHotelsByCoordinates?${qs}`
    : `https://${HOST}/v1/hotels/search-by-coordinates?${qs}`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": HOST,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      // Log dettagliato del motivo: chiave, quota, host o parametri.
      const body = await res.text().catch(() => "");
      console.error(
        `[hotels] RapidAPI ${res.status} host=${HOST} body=${body.slice(0, 300)}`,
      );
      const reason =
        res.status === 401 || res.status === 403
          ? "Chiave RapidAPI non valida o scaduta."
          : res.status === 429
            ? "Quota RapidAPI esaurita per oggi."
            : `RapidAPI ha risposto ${res.status}.`;
      return { hotels: [], error: reason };
    }
    const json = (await res.json()) as {
      data?: { result?: RawHotel[] };
      result?: RawHotel[];
    };
    const raw = json.data?.result ?? json.result ?? [];


    const hotels = raw
      .map((h): BookingHotel | null => {
        const lat = typeof h.latitude === "number" ? h.latitude : null;
        const lng = typeof h.longitude === "number" ? h.longitude : null;
        const name = h.hotel_name_trans ?? h.hotel_name ?? "";
        if (lat === null || lng === null || !name) return null;

        const gross =
          h.composite_price_breakdown?.gross_amount?.value ??
          ((h.currencycode ?? h.currency_code) === "EUR" ? h.min_total_price : undefined);
        const perNight =
          typeof gross === "number" && gross > 0
            ? Math.round((gross / nights) * 100) / 100
            : null;

        const photo = h.main_photo_url
          ? h.main_photo_url.replace("/square60/", "/max500/")
          : null;

        return {
          provider: "booking",
          placeId: `booking:${h.hotel_id ?? `${lat},${lng}`}`,
          name,
          address: [h.address, h.city].filter(Boolean).join(", ") || (h.city ?? ""),
          lat,
          lng,
          pricePerNight: perNight,
          currency: perNight === null ? null : "EUR",
          photoUrl: photo,
          // URL diretto della struttura, con tutti gli alias possibili
          // dell'API. Il fallback di ricerca lo costruisce la UI, che conosce
          // anche il nome del comprensorio.
          bookingUrl:
            [h.url, h.deep_link, h.canonical_url, h.hotel_url, h.hotel_page_url, h.urls?.hotel, h.urls?.deep_link]
              .map((u) => (typeof u === "string" ? u.trim() : ""))
              .find((u) => u.startsWith("http")) ?? null,
          rating: typeof h.review_score === "number" ? h.review_score : null,
          reviewCount: typeof h.review_nr === "number" ? h.review_nr : null,
          distanceM: distanceM({ lat: params.lat, lng: params.lng }, { lat, lng }),
        };
      })
      .filter((h): h is BookingHotel => h !== null)
      // L'API restituisce anche strutture lontane: teniamo solo il raggio scelto.
      .filter((h) => (h.distanceM ?? 0) <= params.radiusM)
      .sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9));

    return { hotels, error: null };
  } catch (err) {
    console.error("RapidAPI Booking errore di rete", err);
    return { hotels: [], error: "Rete non disponibile verso RapidAPI." };
  }
}
