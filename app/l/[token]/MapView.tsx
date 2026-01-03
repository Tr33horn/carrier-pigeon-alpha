"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
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
    map.fitBounds(bounds as any, { padding: [30, 30] });
  }, [map, bounds]);

  return null;
}

export default function MapView(props: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  progress: number; // 0..1
  pigeon?: { lat: number; lon: number; label: string }; // optional override
}) {
  const { origin, dest } = props;

  // Smoothed progress (glide)
  const [displayProgress, setDisplayProgress] = useState(() =>
    clamp01(props.progress)
  );

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayProgress;
    const to = clamp01(props.progress);

    const durationMs = 400;
    const start = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = clamp01((now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplayProgress(lerp(from, to, eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.progress]);

  const computed = {
    lat: lerp(origin.lat, dest.lat, displayProgress),
    lon: lerp(origin.lon, dest.lon, displayProgress),
  };

  const current = props.pigeon
    ? { lat: props.pigeon.lat, lon: props.pigeon.lon }
    : computed;

  const pigeonLabel =
    props.pigeon?.label ??
    "Currently over: Somewhere majestic (pigeon declined to elaborate)";

  const inFlight = clamp01(props.progress) < 0.999; // close enough = delivered

  // Emoji icons (no missing Leaflet images)
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
        zoom={4}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds bounds={line} />
        <Polyline positions={line} />

        <Marker position={[origin.lat, origin.lon]} icon={originIcon} />
        <Marker position={[dest.lat, dest.lon]} icon={destIcon} />

        {/* Pigeon marker + ALWAYS-ON tooltip */}
        <Marker position={[current.lat, current.lon]} icon={pigeonIcon}>
          <Tooltip
            permanent
            direction="top"
            offset={[0, -14]}
            opacity={1}
            className="pigeon-tooltip"
          >
            <span className="pigeon-tooltip-row">
              {inFlight && (
                <>
                  <span className="pigeon-live-dot" aria-hidden="true" />
                  <span className="pigeon-live-text">LIVE</span>
                  <span className="pigeon-sep" aria-hidden="true">
                    •
                  </span>
                </>
              )}
              <span className="pigeon-label">{pigeonLabel}</span>
            </span>
          </Tooltip>
        </Marker>
      </MapContainer>

      <style jsx global>{`
        /* Leaflet tooltip lives outside React tree, so style globally */
        .leaflet-tooltip.pigeon-tooltip {
          background: rgba(0, 0, 0, 0.78);
          color: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);

          /* Alpinhound-ish type */
          font-family: "Bricolage Grotesque", system-ui, -apple-system,
            Segoe UI, Roboto, Arial;
          letter-spacing: 0.2px;
        }

        .leaflet-tooltip.pigeon-tooltip::before {
          border-top-color: rgba(255, 255, 255, 0.18);
        }

        .pigeon-tooltip-row {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }

        .pigeon-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #ff3b30;
          box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.55);
          animation: pigeonPulse 1.15s ease-out infinite;
        }

        .pigeon-live-text {
          font-weight: 900;
          letter-spacing: 0.6px;
          font-size: 11px;
          opacity: 0.95;
        }

        .pigeon-sep {
          opacity: 0.55;
          font-weight: 900;
        }

        .pigeon-label {
          opacity: 0.95;
        }

        @keyframes pigeonPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.55);
            transform: scale(1);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(255, 59, 48, 0);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}