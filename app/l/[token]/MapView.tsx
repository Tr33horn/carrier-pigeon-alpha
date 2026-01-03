"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  const inFlight = useMemo(() => clamp01(props.progress) < 1, [props.progress]);

  const pigeonIcon = useMemo(
    () =>
      L.divIcon({
        className: inFlight ? "pigeonMarker pigeonMarkerFloat" : "pigeonMarker",
        html: "🕊️",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    [inFlight]
  );

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

        {/* Route line */}
        <Polyline
          positions={line}
          pathOptions={{
            color: "#121212",
            weight: 3,
            opacity: 0.55,
          }}
        />

        <Marker position={[origin.lat, origin.lon]} icon={originIcon} />
        <Marker position={[dest.lat, dest.lon]} icon={destIcon} />

        <Marker position={[current.lat, current.lon]} icon={pigeonIcon}>
          <Tooltip
            direction="top"
            offset={[0, -10]}
            opacity={1}
            permanent
            interactive={false}
            className={inFlight ? "pigeonTooltip live" : "pigeonTooltip"}
          >
            <span className="pigeonTooltipRow">
              {inFlight && <span className="pigeonLiveDot" />}
              <span className="pigeonTooltipText">
                {props.tooltipText || "Currently over: somewhere over the U.S."}
              </span>
            </span>
          </Tooltip>
        </Marker>
      </MapContainer>

      <style jsx global>{`
        /* Tooltip */
        .pigeonTooltip.leaflet-tooltip {
          background: rgba(204, 239, 253, 0.3);
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 999px;
          padding: 8px 12px;
          box-shadow: 0 12px 18px rgba(0, 0, 0, 0.14);
          color: #121212;
          font-family: "Bricolage Grotesque", system-ui, -apple-system, Segoe UI,
            Roboto, Arial;
          font-weight: 900;
          font-size: 12px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          white-space: nowrap;
        }

        .pigeonTooltip.leaflet-tooltip::before {
          border-top-color: rgba(204, 239, 253, 0.3);
        }

        .pigeonTooltipRow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .pigeonLiveDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #121212;
          box-shadow: 0 0 0 0 rgba(204, 239, 253, 0.85);
          animation: pulseBlue 1.4s ease-out infinite;
          display: inline-block;
        }

        @keyframes pulseBlue {
          0% {
            box-shadow: 0 0 0 0 rgba(204, 239, 253, 0.75);
            transform: scale(1);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(204, 239, 253, 0);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(204, 239, 253, 0);
            transform: scale(1);
          }
        }

        /* Markers */
        .pigeonMarker {
          filter: drop-shadow(0 10px 12px rgba(0, 0, 0, 0.18));
        }

        .pigeonMarkerFloat {
          animation: pigeonFloat 1.6s ease-in-out infinite;
        }

        @keyframes pigeonFloat {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-2px);
          }
          100% {
            transform: translateY(0px);
          }
        }

        .routeMarker {
          filter: drop-shadow(0 8px 10px rgba(0, 0, 0, 0.14));
        }
      `}</style>
    </div>
  );
}