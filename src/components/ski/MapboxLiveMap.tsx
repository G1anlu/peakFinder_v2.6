import { useMemo } from "react";
import { MapboxMap, type MapLine, type MapMarker } from "@/components/ski/MapboxMap";
import type { LiftStatus, LiveLift, PisteLine, PisteDifficulty } from "@/lib/ski/lifts.types";
import type { LiveMapProps } from "@/components/ski/live-map-types";

const LIFT_STATUS_COLORS: Record<LiftStatus, string> = {
  open: "#16a34a",
  closed: "#dc2626",
  maintenance: "#f59e0b",
};

const PISTE_COLORS: Record<PisteDifficulty, string> = {
  novice: "#22c55e",
  easy: "#22c55e",
  intermediate: "#2563eb",
  advanced: "#dc2626",
  expert: "#111827",
  unknown: "#94a3b8",
};

const liftStatus = (lift: LiveLift): LiftStatus => lift.status ?? (lift.active ? "open" : "closed");

/** Mappa live della giornata su Mapbox GL (stile outdoors 2D). */
export function MapboxLiveMap({
  position,
  lifts,
  pistes = [],
  completedLiftIds = [],
  track = [],
  friends = [],
  overlay,
  className = "relative overflow-hidden rounded-2xl border border-border",
  mapClassName = "h-80 w-full",
}: LiveMapProps) {
  const lines = useMemo<MapLine[]>(() => {
    const out: MapLine[] = [];
    for (const piste of pistes) {
      out.push({
        id: `piste-${piste.id}`,
        coords: piste.geometry,
        color: PISTE_COLORS[piste.difficulty],
        width: 3,
        opacity: 0.75,
      });
    }
    for (const lift of lifts) {
      const status = liftStatus(lift);
      out.push({
        id: `lift-${lift.id}`,
        coords: lift.geometry,
        color: LIFT_STATUS_COLORS[status],
        width: lift.hasBonus && status === "open" ? 5 : 3,
        opacity: status === "open" ? 0.95 : 0.6,
      });
    }
    if (track.length > 1) {
      out.push({ id: "gps-track", coords: track, color: "#00f0ff", width: 5, opacity: 0.85 });
    }
    return out;
  }, [lifts, pistes, track]);

  const markers = useMemo<MapMarker[]>(() => {
    const done = new Set(completedLiftIds);
    const out: MapMarker[] = [];
    for (const lift of lifts) {
      const status = liftStatus(lift);
      out.push({
        id: `base-${lift.id}`,
        lat: lift.base.lat,
        lng: lift.base.lng,
        color: LIFT_STATUS_COLORS[status],
        label: lift.name,
        size: 16,
      });
      if (lift.hasBonus && status === "open") {
        out.push({
          id: `bonus-${lift.id}`,
          lat: lift.top.lat,
          lng: lift.top.lng,
          color: done.has(lift.id) ? "#64748b" : "#a3e635",
          content: done.has(lift.id) ? "✅" : "⭐",
          label: done.has(lift.id)
            ? `Bonus Sfida già raccolto su ${lift.name}`
            : `Arriva in cima a ${lift.name} per +100 Punti Sfida`,
          size: 24,
        });
      }
    }
    for (const friend of friends) {
      out.push({
        id: `friend-${friend.id}`,
        lat: friend.lat,
        lng: friend.lng,
        color: "#f97316",
        content: friend.username.slice(0, 1).toUpperCase(),
        label: friend.username,
        size: 24,
      });
    }
    return out;
  }, [lifts, completedLiftIds, friends]);

  return (
    <MapboxMap
      lines={lines}
      markers={markers}
      userPosition={position}
      overlay={overlay}
      className={className}
      mapClassName={mapClassName}
      ariaLabel="Mappa live impianti, piste e amici"
    />
  );
}
