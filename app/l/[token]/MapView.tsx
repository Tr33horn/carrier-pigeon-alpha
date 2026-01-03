"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds?.length) return;
    map.fitBounds(bounds as any, { padding: [30, 30] });
  }, [map, bounds]);

  return null;
}

export default function MapView(props: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  progress: number; // 0..1
  tooltipText?: string; // NEW
}) {
  const { origin, dest } = props;

  const [displayProgress, setDisplayProgress] = useState(() => clamp01(props.progress));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayProgress;
    const to = clamp01(props.progress);

    const durationMs = 400;
    const start = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = clamp01((now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayProgress(lerp(from, to, eased));

      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.progress]);

  const current = {
    lat: lerp(origin.lat, dest.lat, displayProgress),
    lon: lerp(origin.lon, dest.lon, displayProgress),
  };

  const pigeonIcon = L.divIcon({
    className: "pigeonMarker",
    html: "🕊️",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  const originIcon = L.divIcon({
    className: "routeMarker",
    html: "🏁",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const destIcon = L.divIcon({
    className: "routeMarker",
    html: "📬",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const line: [number, number][] = [
    [origin.lat, origin.lon],
    [dest.lat, dest.lon],
  ];

  return (
    <div
      style={{
        height: 340,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
      }}
    >
      <MapContainer
        center={[current.lat, current.lon]}
        zoom={4}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds bounds={line} />

        <Polyline positions={line} />

        <Marker position={[origin.lat, origin.lon]} icon={originIcon} />
        <Marker position={[dest.lat, dest.lon]} icon={destIcon} />

        <Marker position={[current.lat, current.lon]} icon={pigeonIcon}>
          <Tooltip
            direction="top"
            offset={[0, -10]}
            opacity={1}
            permanent
            className="pigeonTooltip"
          >
            {props.tooltipText || "Currently over: somewhere over the U.S."}
          </Tooltip>
        </Marker>
      </MapContainer>

      {/* Tooltip + marker styling */}
      <style jsx global>{`
        .pigeonTooltip.leaflet-tooltip {
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 999px;
          padding: 8px 12px;
          box-shadow: 0 10px 18px rgba(0,0,0,0.12);
          color: #121212;
          font-family: "Bricolage Grotesque", system-ui, -apple-system, Segoe UI, Roboto, Arial;
          font-weight: 900;
          font-size: 12px;
        }

        .pigeonTooltip.leaflet-tooltip::before {
          border-top-color: rgba(255, 255, 255, 0.92);
        }

        .pigeonMarker {
          filter: drop-shadow(0 8px 10px rgba(0,0,0,0.18));
        }

        .routeMarker {
          filter: drop-shadow(0 8px 10px rgba(0,0,0,0.14));
        }
      `}</style>
    </div>
  );
}