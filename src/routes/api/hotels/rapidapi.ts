import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1000).max(50000).default(25000),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults: z.coerce.number().min(1).max(10).default(2),
});

/**
 * Hotel reali con prezzi Booking.com (RapidAPI).
 * GET /api/hotels/rapidapi?lat=..&lon=..&radius=25000&checkIn=..&checkOut=..
 */
export const Route = createFileRoute("/api/hotels/rapidapi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return Response.json({ error: "Parametri non validi." }, { status: 400 });
        }
        if (!process.env["RAPIDAPI_KEY"]) {
          console.error("[api/hotels] RAPIDAPI_KEY non definita");
          return Response.json(
            { hotels: [], error: "Chiave RapidAPI non configurata sul server." },
            { status: 503 },
          );
        }
        try {
          const { bookingHotelsByCoordinates } = await import("@/lib/ski/booking.server");
          const result = await bookingHotelsByCoordinates({
            lat: parsed.data.lat,
            lng: parsed.data.lon,
            radiusM: parsed.data.radius,
            checkIn: parsed.data.checkIn ?? null,
            checkOut: parsed.data.checkOut ?? null,
            adults: parsed.data.adults,
          });
          if (result.error) console.error(`[api/hotels] ${result.error}`);
          return Response.json(result);
        } catch (err) {
          console.error("[api/hotels] errore imprevisto", err);
          return Response.json(
            { hotels: [], error: "Ricerca hotel non disponibile." },
            { status: 502 },
          );
        }
      },
    },
  },
});
