import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface NearbyPlace {
  provider: string;
  placeId: string;
  name: string;
  rating: number | null;
  address: string;
  lat: number;
  lng: number;
  /** Numero di recensioni (non fornito da OpenStreetMap). */
  userRatingCount?: number | null;
  /** Foto reale della struttura (Booking) oppure null: fallback tematico. */
  photoUrl?: string | null;
  /** Fascia di prezzo, quando disponibile. */
  priceLevel?: string | null;
  /** Distanza in metri dal punto di ricerca. */
  distanceM?: number | null;
  /** Sito ufficiale della struttura/negozio. */
  websiteUri?: string | null;
  /** Prezzo reale per notte in EUR (solo Booking); null = da verificare. */
  pricePerNight?: number | null;
  /** Pagina di prenotazione ufficiale. */
  bookingUrl?: string | null;
  /** Metadati OpenStreetMap utili ai noleggi indipendenti. */
  brand?: string | null;
  phone?: string | null;
  openingHours?: string | null;
}


/** Ricerca impianti di risalita italiani (dataset locale). */
export const searchLifts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().min(2).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { findLifts } = await import("./lifts.server");
    return { lifts: findLifts(data.query) };
  });

/**
 * Alloggi e noleggi attorno alle coordinate scelte.
 * Hotel: prima Booking.com via RapidAPI (prezzi e foto reali); se la chiamata
 * non restituisce strutture, va in errore, in timeout o esaurisce i crediti,
 * si passa in modo automatico e trasparente a LocationIQ/OpenStreetMap.
 * Noleggi: LocationIQ/OpenStreetMap (raggio fino a 25 km).
 */
export const nearbyForLift = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        kind: z.enum(["hotel", "rental"]),
        radiusM: z.number().min(1000).max(25000).default(25000),
        checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
        checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
        adults: z.number().int().min(1).max(10).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = `locationiq_v1:${data.kind}:${data.lat.toFixed(3)}:${data.lng.toFixed(3)}:${data.radiusM}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);

    // 1) Hotel con prezzi reali Booking.com (RapidAPI), con cache di 12 ore su
    // Supabase per la stessa località, le stesse date e gli stessi ospiti.
    if (data.kind === "hotel") {
      const locationQuery = `${data.lat.toFixed(3)},${data.lng.toFixed(3)}:${data.radiusM}`;
      const checkIn = data.checkIn ?? today;
      const checkOut = data.checkOut ?? today;
      const guests = data.adults ?? 2;

      // Garbage collection: ricerche più vecchie di 24 ore o con arrivo passato.
      await supabaseAdmin
        .from("hotel_search_cache")
        .delete()
        .or(
          `created_at.lt.${new Date(Date.now() - 24 * 3_600_000).toISOString()},checkin_date.lt.${today}`,
        );

      const hotelCache = await supabaseAdmin
        .from("hotel_search_cache")
        .select("response_data, created_at")
        .eq("location_query", locationQuery)
        .eq("checkin_date", checkIn)
        .eq("checkout_date", checkOut)
        .eq("guests", guests)
        .maybeSingle();

      if (
        hotelCache.data &&
        Date.now() - new Date(hotelCache.data.created_at).getTime() < 12 * 3_600_000
      ) {
        return {
          places: hotelCache.data.response_data as unknown as NearbyPlace[],
          error: null as string | null,
        };
      }

      const { bookingHotelsByCoordinates } = await import("./booking.server");
      const booking = await bookingHotelsByCoordinates({
        lat: data.lat,
        lng: data.lng,
        radiusM: data.radiusM,
        checkIn: data.checkIn ?? null,
        checkOut: data.checkOut ?? null,
        adults: guests,
      });
      if (booking.hotels.length > 0) {
        const places: NearbyPlace[] = booking.hotels.slice(0, 12).map((h) => ({
          provider: h.provider,
          placeId: h.placeId,
          name: h.name,
          rating: h.rating,
          userRatingCount: h.reviewCount,
          address: h.address,
          lat: h.lat,
          lng: h.lng,
          priceLevel: null,
          websiteUri: h.bookingUrl,
          photoUrl: h.photoUrl,
          distanceM: h.distanceM,
          pricePerNight: h.pricePerNight,
          bookingUrl: h.bookingUrl,
        }));
        await supabaseAdmin.from("hotel_search_cache").upsert(
          {
            location_query: locationQuery,
            checkin_date: checkIn,
            checkout_date: checkOut,
            guests,
            response_data: places as unknown as never,
            created_at: new Date().toISOString(),
          },
          { onConflict: "location_query,checkin_date,checkout_date,guests" },
        );
        return { places, error: null as string | null };
      }
      // Nessun hotel da Booking: si prosegue in silenzio con OpenStreetMap.
    }

    // 2) Noleggi: archivio permanente su Supabase, nessuna nuova chiamata a
    // LocationIQ per una località già mappata.
    if (data.kind === "rental") {
      const stored = await supabaseAdmin
        .from("ski_rentals")
        .select("places")
        .eq("resort_key", key)
        .maybeSingle();
      if (stored.data) {
        return {
          places: stored.data.places as unknown as NearbyPlace[],
          error: null as string | null,
        };
      }
    }

    const cached = await supabaseAdmin
      .from("resort_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .maybeSingle();

    if (cached.data && new Date(cached.data.expires_at) > new Date()) {
      return {
        places: cached.data.payload as unknown as NearbyPlace[],
        error: null as string | null,
      };
    }

    const { locationiqNearby } = await import("./locationiq.server");
    const { places: raw, error } = await locationiqNearby({
      lat: data.lat,
      lng: data.lng,
      kind: data.kind,
      radiusM: data.radiusM,
    });

    if (error) return { places: [] as NearbyPlace[], error };


    const places: NearbyPlace[] = raw.slice(0, data.kind === "hotel" ? 12 : 20).map((p) => ({
      provider: p.provider,
      placeId: p.placeId,
      name: p.name,
      rating: null,
      userRatingCount: null,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      priceLevel: null,
      websiteUri: p.website,
      photoUrl: null,
      distanceM: p.distanceM,
      brand: p.brand,
      phone: p.phone,
      openingHours: p.openingHours,
    }));

    if (places.length > 0) {
      await supabaseAdmin.from("resort_cache").upsert(
        {
          cache_key: key,
          provider: "locationiq",
          kind: data.kind,
          lat: data.lat,
          lng: data.lng,
          radius_m: data.radiusM,
          payload: places as unknown as never,
          expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        },
        { onConflict: "cache_key" },
      );
      if (data.kind === "rental") {
        await supabaseAdmin.from("ski_rentals").upsert(
          {
            resort_key: key,
            lat: data.lat,
            lng: data.lng,
            radius_m: data.radiusM,
            places: places as unknown as never,
          },
          { onConflict: "resort_key" },
        );
      }
    }

    return { places, error: null as string | null };
  });

const selectionSchema = z.object({
  provider: z.string().min(1).max(60),
  placeId: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  rating: z.number().min(0).max(10).nullable().optional(),
  address: z.string().max(300).optional().default(""),
});

export const itinerarySchema = z.object({
  userId: z.string().min(1).optional(),
  dates: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    totalDays: z.number().int().min(1).max(30),
  }),
  resort: z.object({
    slug: z.string().min(1).max(120),
    name: z.string().min(1).max(200),
    coordinates: z.object({ lat: z.number(), lng: z.number() }),
  }),
  selectedHotel: selectionSchema,
  selectedRental: selectionSchema,
  /** Voto di efficienza complessivo del viaggio (0-10). */
  efficiencyScore: z.number().min(0).max(10).nullable().optional(),
  /** Dettaglio analitico dei costi stimati. */
  costBreakdown: z
    .object({
      travel: z.number().nullable().default(0),
      hotel: z.number().nullable().default(0),
      rental: z.number().nullable().default(0),
      skipass: z.number().nullable().default(0),
      total: z.number().nullable().default(0),
    })
    .partial()
    .nullable()
    .optional(),
});

export type ItineraryPayload = z.infer<typeof itinerarySchema>;

export function itineraryRow(payload: ItineraryPayload, userId: string) {
  return {
    user_id: userId,
    start_date: payload.dates.startDate,
    end_date: payload.dates.endDate,
    total_days: payload.dates.totalDays,
    resort_slug: payload.resort.slug,
    resort_name: payload.resort.name,
    resort_lat: payload.resort.coordinates.lat,
    resort_lng: payload.resort.coordinates.lng,
    hotel_provider: payload.selectedHotel.provider,
    hotel_place_id: payload.selectedHotel.placeId,
    hotel_name: payload.selectedHotel.name,
    hotel_rating: payload.selectedHotel.rating ?? null,
    hotel_address: payload.selectedHotel.address ?? "",
    rental_provider: payload.selectedRental.provider,
    rental_place_id: payload.selectedRental.placeId,
    rental_name: payload.selectedRental.name,
    rental_rating: payload.selectedRental.rating ?? null,
    rental_address: payload.selectedRental.address ?? "",
    efficiency_score: payload.efficiencyScore ?? null,
    cost_breakdown: (payload.costBreakdown ?? null) as unknown as never,
  };
}

/** Salva l'itinerario dell'utente autenticato. */
export const saveItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => itinerarySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("itineraries")
      .insert(itineraryRow(data, context.userId))
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

/** Itinerari salvati dall'utente autenticato. */
export const listItineraries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("itineraries")
      .select("*")
      .order("start_date", { ascending: true });
    if (error) throw new Error(error.message);
    return { itineraries: data ?? [] };
  });

export const deleteItinerary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("itineraries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
