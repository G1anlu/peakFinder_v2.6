import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, CircleMarker } from "leaflet";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  LiftStatus,
  LiveLift,
  PisteLine,
  PisteDifficulty,
} from "@/lib/ski/lifts.types";

/** Mappa di base con rilievi e curve di livello della montagna. */
const TOPO_TILE_URL = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
const TOPO_ATTRIBUTION =
  '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) · &copy; OpenStreetMap';
/** Overlay trasparente con piste da sci e impianti di risalita. */
const SKI_OVERLAY_URL = "https://tiles.opensnowmap.org/lines/{z}/{x}/{y}.png";
const SKI_OVERLAY_ATTRIBUTION = '&copy; <a href="https://www.opensnowmap.org">OpenSnowMap</a>';


/** Colore del tracciato in base allo stato operativo dell'impianto. */
const LIFT_STATUS_COLORS: Record<LiftStatus, string> = {
  open: "#16a34a",
  closed: "#dc2626",
  maintenance: "#f59e0b",
};

const LIFT_STATUS_LABELS: Record<LiftStatus, string> = {
  open: "Aperto",
  closed: "Chiuso",
  maintenance: "In manutenzione",
};

const PISTE_COLORS: Record<PisteDifficulty, string> = {
  novice: "#22c55e",
  easy: "#22c55e",
  intermediate: "#2563eb",
  advanced: "#dc2626",
  expert: "#111827",
  unknown: "#94a3b8",
};

const PISTE_LABELS: Record<PisteDifficulty, string> = {
  novice: "Pista verde",
  easy: "Pista verde",
  intermediate: "Pista blu",
  advanced: "Pista rossa",
  expert: "Pista nera",
  unknown: "Pista",
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );

interface Props {
  /** Posizione GPS corrente dello sciatore. */
  position: { lat: number; lng: number } | null;
  /** Impianti vicini con tracciato e stazioni. */
  lifts: LiveLift[];
  /** Piste da discesa vicine. */
  pistes?: PisteLine[];
  /** Impianti già completati oggi. */
  completedLiftIds?: number[];
  /** Tracciato GPS reale percorso durante la sfida. */
  track?: Array<[number, number]>;
  /** Contenuto sovrapposto alla mappa (HUD punteggi). */
  overlay?: React.ReactNode;
  /** Classi del contenitore (per la modalità a tutto schermo). */
  className?: string;
  /** Classi dell'area mappa. */
  mapClassName?: string;
}

/**
 * Mappa live della giornata: posizione GPS, piste, tracciati degli impianti e
 * Bonus Sfida sulla stazione di monte degli impianti con bonus attivo.
 */
export function ResortLiveMap({
  position,
  lifts,
  pistes = [],
  completedLiftIds = [],
  track = [],
  overlay,
  className = "relative overflow-hidden rounded-2xl border border-border",
  mapClassName = "h-80 w-full",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const pisteRef = useRef<LayerGroup | null>(null);
  const meRef = useRef<LayerGroup | null>(null);
  const meMarkerRef = useRef<CircleMarker | null>(null);
  const animRef = useRef<number | null>(null);
  const shownPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const trackRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const centeredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await import("leaflet/dist/leaflet.css");
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
          center: position ? [position.lat, position.lng] : [45.9, 10.6],
          zoom: position ? 14 : 6,
          scrollWheelZoom: false,
});
        // Base topografica con rilievi + overlay trasparente piste/impianti.
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
        leafletRef.current = L;
        mapRef.current = map;
        pisteRef.current = L.layerGroup().addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        trackRef.current = L.layerGroup().addTo(map);
        meRef.current = L.layerGroup().addTo(map);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracciati impianti + casse del tesoro
  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    const done = new Set(completedLiftIds);
    for (const lift of lifts) {
      const claimed = done.has(lift.id);
      const status: LiftStatus = lift.status ?? (lift.active ? "open" : "closed");
      const open = status === "open";
      const color = LIFT_STATUS_COLORS[status];
      const badge = `<span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;background:${color}">${LIFT_STATUS_LABELS[status]}</span>`;
      const popup = `<strong>${escapeHtml(lift.name)}</strong><br/>${escapeHtml(
        lift.type ? lift.type.replace(/_/g, " ") : "Impianto di risalita",
      )}${lift.resortName ? `<br/>${escapeHtml(lift.resortName)}` : ""}<br/>${badge}${
        lift.hasBonus && open ? "<br/>⭐ Bonus Sfida in cima (+100 Punti Sfida)" : ""
      }`;
      L.polyline(lift.geometry, {
        color,
        weight: lift.hasBonus && !claimed && open ? 5 : 3,
        opacity: open ? 0.95 : 0.6,
        dashArray: open ? undefined : "6 6",
      })
        .bindPopup(popup)
        .addTo(layer);

      // Marcatore alla stazione di valle: badge stato al click.
      L.circleMarker([lift.base.lat, lift.base.lng], {
        radius: 5,
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      })
        .bindPopup(popup)
        .addTo(layer);

      if (lift.hasBonus && open) {
        L.marker([lift.top.lat, lift.top.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="font-size:22px;line-height:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));opacity:${
              claimed ? 0.45 : 1
            }">${claimed ? "✅" : "⭐"}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        })
          .bindPopup(
            claimed
              ? `Bonus Sfida già raccolto su ${escapeHtml(lift.name)}`
              : `Arriva in cima a <strong>${escapeHtml(lift.name)}</strong> per +100 Punti Sfida`,
          )
          .addTo(layer);
      }
    }
  }, [ready, lifts, completedLiftIds]);

  // Piste da discesa
  useEffect(() => {
    const L = leafletRef.current;
    const layer = pisteRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    for (const piste of pistes) {
      L.polyline(piste.geometry, {
        color: PISTE_COLORS[piste.difficulty],
        weight: 3,
        opacity: 0.75,
      })
        .bindPopup(
          `<strong>${escapeHtml(piste.name ?? PISTE_LABELS[piste.difficulty])}</strong><br/>${
            PISTE_LABELS[piste.difficulty]
          }`,
        )
        .addTo(layer);
    }
  }, [ready, pistes]);

  // Tracciato GPS percorso
  useEffect(() => {
    const L = leafletRef.current;
    const layer = trackRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    if (track.length < 2) return;
    L.polyline(track, { color: "#00f0ff", weight: 5, opacity: 0.8 }).addTo(layer);
  }, [ready, track]);

  // Posizione dello sciatore: il marker viene creato una sola volta e poi
  // spostato con un'interpolazione fluida, senza ridisegnare la mappa.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = meRef.current;
    const map = mapRef.current;
    if (!ready || !L || !layer || !map || !position) return;

    if (!meMarkerRef.current) {
      meMarkerRef.current = L.circleMarker([position.lat, position.lng], {
        radius: 8,
        color: "#0ea5e9",
        fillColor: "#0ea5e9",
        fillOpacity: 0.9,
        weight: 2,
      })
        .bindPopup("Sei qui")
        .addTo(layer);
      shownPosRef.current = { lat: position.lat, lng: position.lng };
      map.setView([position.lat, position.lng], 15);
      centeredRef.current = true;
      return;
    }

    const marker = meMarkerRef.current;
    const from = shownPosRef.current ?? { lat: position.lat, lng: position.lng };
    const to = { lat: position.lat, lng: position.lng };
    const startedAt = performance.now();
    const duration = 800;

    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    const step = (now: number) => {
      const t = Math.min((now - startedAt) / duration, 1);
      // easing dolce: niente scatti del puntino tra un punto GPS e l'altro
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const lat = from.lat + (to.lat - from.lat) * e;
      const lng = from.lng + (to.lng - from.lng) * e;
      marker.setLatLng([lat, lng]);
      shownPosRef.current = { lat, lng };
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(step);

    // Pan leggero solo se lo sciatore esce dalla porzione di mappa visibile.
    const visible = map.getBounds().pad(-0.25);
    if (!visible.contains([to.lat, to.lng])) {
      map.panTo([to.lat, to.lng], { animate: true, duration: 0.8 });
    }

    return () => {
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [ready, position]);


  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }

  return (
    <div className={className}>
      <div ref={containerRef} className={mapClassName} aria-label="Mappa live impianti e piste" />
      {overlay}
      {!ready && <Skeleton className="absolute inset-0" />}
    </div>
  );
}
