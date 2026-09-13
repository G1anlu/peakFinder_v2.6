import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PisteLine } from "./lifts.types";

export type { PisteLine };

/** Piste da discesa attorno alla posizione GPS (OpenStreetMap). */
export const nearbyPistes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusM: z.number().min(500).max(30000).default(8000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { pistesNear } = await import("./pistes.server");
    return { pistes: await pistesNear(data.lat, data.lng, data.radiusM) };
  });
