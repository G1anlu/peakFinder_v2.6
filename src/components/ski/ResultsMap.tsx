import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { RankedResort } from "@/lib/ski/types";
import { decodePolyline } from "@/lib/polyline";
import {
  LOCATIONIQ_ATTRIBUTION,
  LOCATIONIQ_MAX_ZOOM,
  LOCATIONIQ_TILE_URL,
} from "@/lib/ski/locationiq";

interface Props {
  origin: { lat: number; lng: number };
  result: RankedResort;
}

/** Mappa del viaggio (partenza, impianti, parcheggio, noleggi) su Leaflet. */
export function ResultsMap({ origin, result }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await import("leaflet/dist/leaflet.css");
        const L = (await import("leaflet")).default;
        if (cancelled || !ref.current) return;

        mapRef.current?.remove();
        const map = L.map(ref.current, {
          center: [result.resort.lat, result.resort.lng],
          zoom: 11,
          scrollWheelZoom: false,
        });
        L.tileLayer(LOCATIONIQ_TILE_URL, {
          attribution: LOCATIONIQ_ATTRIBUTION,
          maxZoom: LOCATIONIQ_MAX_ZOOM,
        }).addTo(map);
        mapRef.current = map;

        const points: Array<[number, number]> = [];
        const marker = (lat: number, lng: number, title: string, color: string) => {
          L.circleMarker([lat, lng], {
            radius: 8,
            color: "#ffffff",
            weight: 2,
            fillColor: color,
            fillOpacity: 1,
          })
            .addTo(map)
            .bindTooltip(title);
          points.push([lat, lng]);
        };

        marker(origin.lat, origin.lng, "Partenza", "#0ea5e9");
        marker(result.resort.lat, result.resort.lng, "Impianti", "#f97316");
        if (result.parking) {
          marker(
            result.parking.lat,
            result.parking.lng,
            `Parcheggio: ${result.parking.name}`,
            "#22c55e",
          );
        }
        for (const rental of result.rentals) {
          marker(rental.lat, rental.lng, `Noleggio: ${rental.name}`, "#a855f7");
        }

        if (result.drive.polyline) {
          const path = decodePolyline(result.drive.polyline);
          if (path.length > 1) {
            L.polyline(path, { color: "#0ea5e9", weight: 4, opacity: 0.85 }).addTo(map);
            points.push(...path);
          }
        }

        if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [origin, result]);

  if (failed) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
        Mappa non disponibile al momento.
      </div>
    );
  }

  return <div ref={ref} className="h-72 w-full rounded-xl border border-border" />;
}

export default ResultsMap;
