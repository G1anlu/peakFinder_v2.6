import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  kind: z.enum(["hotel", "rental"]).default("hotel"),
  radius: z.coerce.number().min(1000).max(20000).default(20000),
});

/**
 * Ricerca strutture (alloggi / noleggi) vicine alle coordinate del
 * comprensorio tramite LocationIQ Nearby API.
 * GET /api/locationiq/nearby?lat=..&lon=..&kind=hotel|rental&radius=10000
 */
export const Route = createFileRoute("/api/locationiq/nearby")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return Response.json({ error: "Parametri non validi." }, { status: 400 });
        }
        const { locationiqNearby } = await import("@/lib/ski/locationiq.server");
        const result = await locationiqNearby({
          lat: parsed.data.lat,
          lng: parsed.data.lon,
          kind: parsed.data.kind,
          radiusM: parsed.data.radius,
        });
        return Response.json(result);
      },
    },
  },
});
