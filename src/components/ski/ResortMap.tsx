import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { Skeleton } from "@/components/ui/skeleton";
import type { Resort } from "@/lib/ski/types";
import { resortSeason } from "@/lib/ski/season";

const TOPO_TILE_URL = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
const TOPO_ATTRIBUTION =
  '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) · &copy; OpenStreetMap';
const SKI_OVERLAY_URL = "https://tiles.opensnowmap.org/lines/{z}/{x}/{y}.png";
const SKI_OVERLAY_ATTRIBUTION = '&copy; <a href="https://www.opensnowmap.org">OpenSnowMap</a>';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );

/**
 * Mappa interattiva dei comprensori su Leaflet con tile LocationIQ: un marker
 * per ogni località (base.lat/base.lng). Click ⇒ popup con nome, stato
 * stagionale e link al dettaglio.
 */
export function ResortMap({ resorts }: { resorts: Resort[] }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delega la navigazione dei link dentro il popup al router.
  useEffect(() => {
    const handler = (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest?.(
        "a[data-resort-slug]",
      ) as HTMLAnchorElement | null;
      if (!target) return;
      event.preventDefault();
      void navigate({
        to: "/esplora/$slug",
        params: { slug: target.dataset["resortSlug"]! },
      });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await import("leaflet/dist/leaflet.css");
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
          center: [45.9, 10.6],
          zoom: 6,
          scrollWheelZoom: false,
        });
        L.tileLayer(TOPO_TILE_URL, {
          attribution: TOPO_ATTRIBUTION,
          maxZoom: 17,
        }).addTo(map);
        L.tileLayer(SKI_OVERLAY_URL, {
          attribution: SKI_OVERLAY_ATTRIBUTION,
          maxZoom: 19,
          transparent: true,
          opacity: 0.95,
          zIndex: 500,
        }).addTo(map);
        mapRef.current = map;
        requestAnimationFrame(() => map.invalidateSize());
        setReady(true);
      } catch {
        if (!cancelled) setError("Mappa non disponibile al momento.");
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const points: Array<[number, number]> = [];

      for (const resort of resorts) {
        if (!Number.isFinite(resort.lat) || !Number.isFinite(resort.lng)) continue;
        const season = resortSeason(resort);
        const marker = L.circleMarker([resort.lat, resort.lng], {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: season.open ? "#1d4ed8" : "#94a3b8",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:190px;font-family:inherit">
               <strong style="display:block;font-size:14px">${escapeHtml(resort.name)}</strong>
               <span style="font-size:12px;color:#475569">${escapeHtml(resort.region)}</span>
               <div style="margin-top:6px;font-size:12px;font-weight:600;color:${
                 season.open ? "#1d4ed8" : "#64748b"
               }">${season.open ? "Aperto" : "Chiuso"}</div>
               <a data-resort-slug="${escapeHtml(resort.id)}" href="/esplora/${encodeURIComponent(
                 resort.id,
               )}" style="display:inline-block;margin-top:8px;font-size:13px;font-weight:600;color:#1d4ed8">Vedi dettaglio →</a>
             </div>`,
          );
        marker.on("dblclick", () => {
          void navigate({ to: "/esplora/$slug", params: { slug: resort.id } });
        });
        markersRef.current.push(marker as unknown as LeafletMarker);
        points.push([resort.lat, resort.lng]);
      }

      if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, resorts, navigate]);

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      <div ref={containerRef} className="h-[420px] w-full" aria-label="Mappa dei comprensori" />
      {!ready && (
        <div className="absolute inset-0 bg-background/80 p-4" aria-hidden>
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
