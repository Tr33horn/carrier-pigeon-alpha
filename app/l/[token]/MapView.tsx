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

// ✅ Match the LetterStatusPage values
export type MapStyle = "carto-positron" | "carto-voyager" | "carto-dark";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function getCarto(style: MapStyle) {
  // CARTO raster tiles
  if (style === "carto-voyager") {
    return {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      isDark: false,
    };
  }

  if (style === "carto-dark") {
    return {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      isDark: true,
    };
  }

  // carto-positron (light default)
  return {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    isDark: false,
  };
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
  mapStyle?: MapStyle;
}) {
  const { origin, dest } = props;

  const mapStyle: MapStyle = props.mapStyle ?? "carto-positron";
  const tile = useMemo(() => getCarto(mapStyle), [mapStyle]);

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
      className: inFlight ? "pigeonMarker live" : "pigeonMarker",
      html: `
        <div class="pigeonPulseWrap">
          <span class="pigeonPulseRing"></span>
          <span class="pigeonPulseRing ring2"></span>
          <div class="pigeonDot"></div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    }),
  [inFlight]
);

const originIcon = useMemo(
  () =>
    L.divIcon({
      className: "routeMarker originDot",
      html: `<span></span>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    }),
  []
);

const destIcon = useMemo(
  () =>
    L.divIcon({
      className: "routeMarker destRing",
      html: `<span></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
  []
);

  const line: [number, number][] = [
    [origin.lat, origin.lon],
    [dest.lat, dest.lon],
  ];

  // ✅ Optional: better contrast on dark tiles
  const routeColor = tile.isDark ? "rgba(255,255,255,0.85)" : "#121212";
  const routeOpacity = tile.isDark ? 0.8 : 0.55;

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
        <TileLayer attribution={tile.attribution} url={tile.url} />

        <FitBounds bounds={line} />

        <Polyline
          positions={line}
          pathOptions={{
            color: routeColor,
            weight: 3,
            opacity: routeOpacity,
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
    </div>
  );
}