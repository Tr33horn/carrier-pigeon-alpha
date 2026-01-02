"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// This makes the map auto-zoom so the full route fits on screen.
function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds?.length) return;
    // padding gives the line breathing room inside the frame
    map.fitBounds(bounds as any, { padding: [30, 30] });
  }, [map, bounds]);

  return null;
}

export default function MapView(props: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  progress: number; // 0..1
}) {
  const { origin, dest } = props;

  // This is the progress value we show on the map (smoothed).
  const [displayProgress, setDisplayProgress] = useState(() => clamp01(props.progress));

  // Used to cancel previous animation frames
  const rafRef = useRef<number | null>(null);

  // When the parent progress updates (every second), glide toward it.
  useEffect(() => {
    const from = displayProgress;
    const to = clamp01(props.progress);

    const durationMs = 400; // glide duration
    const start = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = clamp01((now - start) / durationMs);
      // easeOutCubic
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

  // Calculate where the pigeon is right now (based on smoothed progress).
  const current = {
    lat: lerp(origin.lat, dest.lat, displayProgress),
    lon: lerp(origin.lon, dest.lon, displayProgress),
  };

  // Emoji icons so we don't rely on Leaflet's default marker images.
  const pigeonIcon = L.divIcon({
    className: "",
    html: "🕊️",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const originIcon = L.divIcon({
    className: "",
    html: "🏁",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const destIcon = L.divIcon({
    className: "",
    html: "📬",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // Route line endpoints
  const line: [number, number][] = [
    [origin.lat, origin.lon],
    [dest.lat, dest.lon],
  ];

  return (
    <div
      style={{
        height: 320,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid #333",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <MapContainer
        center={[current.lat, current.lon]}
        zoom={4} // FitBounds will override this
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit the route */}
        <FitBounds bounds={line} />

        {/* Route line */}
        <Polyline positions={line} />

        {/* Markers */}
        <Marker position={[origin.lat, origin.lon]} icon={originIcon} />
        <Marker position={[dest.lat, dest.lon]} icon={destIcon} />
        <Marker position={[current.lat, current.lon]} icon={pigeonIcon} />
      </MapContainer>
    </div>
  );
}