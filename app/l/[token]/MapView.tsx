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
export type MapStyle =
  | "carto-positron"
  | "carto-voyager"
  | "carto-positron-nolabels";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function getCarto(style: MapStyle) {
  if (style === "carto-voyager") {
    return {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    };
  }

  if (style === "carto-positron-nolabels") {
    return {
      url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    };
  }

  return {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
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

/** Keep tooltips sane + always include "Location:" */
function normalizeTooltip(text?: string) {
  let t = (text || "").trim();
  if (!t) return "Location: Somewhere over the U.S.";

  // strip accidental prefixes, but keep Location:
  t = t.replace(/^currently over:\s*/i, "").trim();

  // If it comes in like "Over X", keep it, but still ensure Location:
  if (!/^location:\s*/i.test(t)) t = `Location: ${t}`;

  return t;
}

/** Quadratic Bezier point */
function bezier2(
  a: { x: number; y: number },
  c: { x: number; y: number },
  b: { x: number; y: number },
  t: number
) {
  const u = 1 - t;
  const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
  const y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
  return { x, y };
}

/**
 * Build a curved route polyline that "wobbles" by moving the control point.
 * - Origin/dest are fixed
 * - Curve shape changes over time (wind wobble)
 */
function makeWobblyCurve(args: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  phase: number; // seconds
  points?: number; // resolution
}) {
  const { origin, dest, phase } = args;
  const steps = Math.max(16, args.points ?? 44);

  // Map lat/lon into a simple XY plane (lon = x, lat = y)
  const A = { x: origin.lon, y: origin.lat };
  const B = { x: dest.lon, y: dest.lat };

  const dx = B.x - A.x;
  const dy = B.y - A.y;

  // Distance in "degrees" (good enough for vibes)
  const dist = Math.hypot(dx, dy);

  // Midpoint
  const mx = (A.x + B.x) / 2;
  const my = (A.y + B.y) / 2;

  // Perpendicular unit vector
  const px = -dy;
  const py = dx;
  const plen = Math.hypot(px, py) || 1;
  const ux = px / plen;
  const uy = py / plen;

  // Base curve height proportional to distance, clamped
  // (bigger trips get a nicer arc)
  const baseArc = Math.min(2.2, Math.max(0.25, dist * 0.18));

  // Wind wobble: small sinusoidal modulation
  const wobble = Math.sin(phase * 0.9) * 0.22 + Math.sin(phase * 1.7) * 0.12;

  // Control point offset amount
  const arc = baseArc * (1 + wobble);

  // Control point
  const C = { x: mx + ux * arc, y: my + uy * arc };

  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = bezier2(A, C, B, t);
    // back to Leaflet lat/lon
    pts.push([p.y, p.x]);
  }
  return pts;
}

export default function MapView(props: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  progress: number; // 0..1
  tooltipText?: string; // any string; we'll normalize into "Location: ..."
  mapStyle?: MapStyle;
}) {
  const { origin, dest } = props;

  const mapStyle: MapStyle = props.mapStyle ?? "carto-positron";
  const tile = useMemo(() => getCarto(mapStyle), [mapStyle]);

  const [displayProgress, setDisplayProgress] = useState(() =>
    clamp01(props.progress)
  );
  const rafRef = useRef<number | null>(null);

  // ✅ animate marker progress (unchanged)
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

  // ✅ phase for route wobble
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    let alive = true;
    let last = performance.now();

    const loop = (now: number) => {
      if (!alive) return;
      const dt = (now - last) / 1000;
      last = now;
      // speed of wobble feel
      setPhase((p) => p + dt);
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    return () => {
      alive = false;
    };
  }, []);

  const current = {
    lat: lerp(origin.lat, dest.lat, displayProgress),
    lon: lerp(origin.lon, dest.lon, displayProgress),
  };

  const inFlight = useMemo(() => clamp01(props.progress) < 1, [props.progress]);

  // ✅ Pulsing live marker (no pigeon emoji)
  const liveIcon = useMemo(
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

  // ✅ Origin = small filled dot
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

  // ✅ Destination = map pin icon
  const destIcon = useMemo(
    () =>
      L.divIcon({
        className: "routeMarker destPin",
        html: `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linejoin="round"
            />
            <circle cx="12" cy="10" r="2.5" fill="currentColor"/>
          </svg>
        `,
        iconSize: [22, 28],
        iconAnchor: [11, 28],
      }),
    []
  );

  // ✅ bounds should remain stable (origin + dest only)
  const boundsLine: [number, number][] = [
    [origin.lat, origin.lon],
    [dest.lat, dest.lon],
  ];

  // ✅ the route polyline changes shape (wobbly curve)
  const routePts = useMemo(() => {
    return makeWobblyCurve({ origin, dest, phase, points: 44 });
  }, [origin, dest, phase]);

  const routeColor = "#121212";
  const routeOpacity = 0.55;

  const tooltip = useMemo(() => normalizeTooltip(props.tooltipText), [props.tooltipText]);

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

        <FitBounds bounds={boundsLine} />

        <Polyline
          positions={routePts}
          pathOptions={{
            color: routeColor,
            weight: 3,
            opacity: routeOpacity,
          }}
        />

        <Marker position={[origin.lat, origin.lon]} icon={originIcon} />
        <Marker position={[dest.lat, dest.lon]} icon={destIcon} />

        <Marker position={[current.lat, current.lon]} icon={liveIcon}>
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
              <span className="pigeonTooltipText">{tooltip}</span>
            </span>
          </Tooltip>
        </Marker>
      </MapContainer>
    </div>
  );
}