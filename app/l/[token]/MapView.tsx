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
  tooltipText?: string;
}) {
  const { origin, dest } = props;

  const [displayProgress, setDisplayProgress] = useState(() => clamp01(props.progress));
  const rafRef = useRef<number | null>(null);

  // tiny “alive” bob
  const [bob, setBob] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBob((b) => (b === 0 ? 1 : 0)), 900);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const from = displayProgress;
    const to = clamp01(props.progress);
    const durationMs = 420;
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
    className: "pigeon-marker",
    html: `<div style="transform: translateY(${bob ? -2 : 0}px)">🕊️</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  const originIcon = L.divIcon({
    className: "route-marker",
    html: "🏁",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const destIcon = L.divIcon({
    className: "route-marker",
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
        background: "#FFFFFF",
        boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
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
            permanent
            direction="top"
            offset={[0, -10]}
            className="pigeon-tooltip"
            opacity={1}
          >
            <div style={{ fontWeight: 900, fontSize: 12 }}>
              {props.tooltipText || "Currently over: somewhere suspicious"}
            </div>
          </Tooltip>
        </Marker>
      </MapContainer>

      <style jsx global>{`
        /* Leaflet tooltip styling */
        .leaflet-tooltip.pigeon-tooltip {
          background: #ffffff;
          color: #111;
          border: none;
          border-radius: 12px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.14);
          padding: 8px 10px;
        }
        .leaflet-tooltip.pigeon-tooltip::before {
          border-top-color: #ffffff;
        }

        /* Optional: reduce map UI noise */
        .leaflet-control-attribution {
          opacity: 0.45;
        }
      `}</style>
    </div>
  );
}