import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Ricerca indirizzi/luoghi con coordinate (LocationIQ Search API). */
export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().min(3).max(120) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { locationiqSearch } = await import("./locationiq.server");
    return locationiqSearch(data.query);
  });

/** Indirizzo leggibile a partire da coordinate GPS (LocationIQ Reverse API). */
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ lat: z.number(), lng: z.number() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { locationiqReverse } = await import("./locationiq.server");
    return locationiqReverse(data.lat, data.lng);
  });

const destinationSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
});

/** Distanza, tempo di guida e tracciato per ogni destinazione (LocationIQ Directions). */
export const computeDrives = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        origin: z.object({ lat: z.number(), lng: z.number() }),
        destinations: z.array(destinationSchema).min(1).max(12),
        departureTime: z.string().datetime().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { locationiqRoute } = await import("./locationiq.server");
    const results: Record<
      string,
      {
        distanceKm: number;
        durationHours: number;
        polyline?: string;
        estimated?: boolean;
        trafficAware?: boolean;
      }
    > = {};
    let error: string | null = null;

    for (const destination of data.destinations) {
      const route = await locationiqRoute(data.origin, {
        lat: destination.lat,
        lng: destination.lng,
      });
      if (!route) {
        error = "Alcuni percorsi non sono disponibili al momento.";
        continue;
      }
      results[destination.id] = { ...route, trafficAware: false };
    }

    return { drives: results, error };
  });
