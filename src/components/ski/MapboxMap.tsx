import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMapInstance, Marker as MapboxMarker } from "mapbox-gl";
import { Skeleton } from "@/components/ui/skeleton";
import { MAPBOX_STYLE, MAPBOX_TOKEN } from "@/lib/ski/mapbox";

export interface MapLine {
  id: string;
  /** Coordinate in formato [lat, lng]. */
  coords: Array<[number, number]>;
  color: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  /** Emoji o iniziali mostrate dentro il pallino. */
  content?: string;
  label?: string;
  size?: number;
}

interface Props {
  center?: { lat: number; lng: number } | null;
  zoom?: number;
  lines?: MapLine[];
  markers?: MapMarker[];
  /** Posizione dell'utente: marker pulsante che segue il GPS. */
  userPosition?: { lat: number; lng: number } | null;
  /** Centra la mappa sull'utente a ogni aggiornamento. */
  followUser?: boolean;
  overlay?: React.ReactNode;
  className?: string;
  mapClassName?: string;
  ariaLabel?: string;
}

const el = (html: string) => {
  const node = document.createElement("div");
  node.innerHTML = html;
  return node.firstElementChild as HTMLElement;
};

const dot = (color: string, content: string, size: number) =>
  el(
    `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;font-size:${Math.round(
      size * 0.55,
    )}px;line-height:1;color:#fff;font-weight:700">${content}</div>`,
  );

/** Mappa 2D Mapbox GL (stile outdoors) con controlli di zoom e ricentraggio. */
export function MapboxMap({
  center,
  zoom = 13,
  lines = [],
  markers = [],
  userPosition = null,
  followUser = true,
  overlay,
  className = "relative overflow-hidden rounded-2xl border border-border",
  mapClassName = "h-80 w-full",
  ariaLabel = "Mappa",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMapInstance | null>(null);
  const glRef = useRef<typeof import("mapbox-gl") | null>(null);
  const markerRefs = useRef<Map<string, MapboxMarker>>(new Map());
  const meRef = useRef<MapboxMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await import("mapbox-gl/dist/mapbox-gl.css");
        const gl = (await import("mapbox-gl")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;
        gl.accessToken = MAPBOX_TOKEN;
        const start = center ?? userPosition ?? { lat: 45.9, lng: 10.6 };
        const map = new gl.Map({
          container: containerRef.current,
          style: MAPBOX_STYLE,
          center: [start.lng, start.lat],
          zoom: center || userPosition ? zoom : 6,
          attributionControl: true,
        });
        map.addControl(new gl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(
          new gl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true,
          }),
          "top-right",
        );
        map.on("load", () => {
          map.addSource("ski-lines", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "ski-lines",
            type: "line",
            source: "ski-lines",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": ["get", "color"],
              "line-width": ["get", "width"],
              "line-opacity": ["get", "opacity"],
            },
          });
          map.resize();
          if (!cancelled) setReady(true);
        });
        glRef.current = gl;
        mapRef.current = map;
        requestAnimationFrame(() => map.resize());
      } catch {
        if (!cancelled) setError("Mappa non disponibile al momento.");
      }
    })();
    return () => {
      cancelled = true;
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current.clear();
      meRef.current?.remove();
      meRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracciati (piste, impianti, percorso GPS)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource("ski-lines");
    if (!source || !("setData" in source)) return;
    source.setData({
      type: "FeatureCollection",
      features: lines
        .filter((l) => l.coords.length > 1)
        .map((l) => ({
          type: "Feature" as const,
          properties: {
            color: l.color,
            width: l.width ?? 3,
            opacity: l.opacity ?? 0.85,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: l.coords.map(([lat, lng]) => [lng, lat]),
          },
        })),
    });
  }, [ready, lines]);

  // Marker (impianti, bonus, amici in stanza)
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const existing = markerRefs.current.get(m.id);
      if (existing) {
        existing.setLngLat([m.lng, m.lat]);
        continue;
      }
      const marker = new gl.Marker({
        element: dot(m.color ?? "#0ea5e9", m.content ?? "", m.size ?? 22),
      }).setLngLat([m.lng, m.lat]);
      if (m.label) marker.setPopup(new gl.Popup({ offset: 14 }).setText(m.label));
      marker.addTo(map);
      markerRefs.current.set(m.id, marker);
    }
    for (const [id, marker] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [ready, markers]);

  // Posizione dell'utente
  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!ready || !map || !gl || !userPosition) return;
    if (!meRef.current) {
      meRef.current = new gl.Marker({ element: dot("#0ea5e9", "●", 20) })
        .setLngLat([userPosition.lng, userPosition.lat])
        .addTo(map);
      map.easeTo({ center: [userPosition.lng, userPosition.lat], zoom });
      return;
    }
    meRef.current.setLngLat([userPosition.lng, userPosition.lat]);
    if (followUser && !map.getBounds()?.contains([userPosition.lng, userPosition.lat])) {
      map.easeTo({ center: [userPosition.lng, userPosition.lat], duration: 800 });
    }
  }, [ready, userPosition, followUser, zoom]);

  // Centro esplicito (schede località / risultati)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !center) return;
    map.easeTo({ center: [center.lng, center.lat], zoom, duration: 600 });
  }, [ready, center, zoom]);

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>;

  return (
    <div className={className}>
      <div ref={containerRef} className={mapClassName} aria-label={ariaLabel} />
      {overlay}
      {!ready && <Skeleton className="absolute inset-0" />}
    </div>
  );
}
