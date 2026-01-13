"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

// ✅ dev-only sleep overlay helpers (pure functions)
import { isSleepingAt, offsetMinutesFromLon, initialSleepSkipUntilUtcMs } from "@/app/lib/flightSleep";

// ✅ Match the LetterStatusPage values
export type MapStyle = "carto-positron" | "carto-voyager" | "carto-positron-nolabels" | "ink-sketch";
export type MarkerMode = "flying" | "sleeping" | "delivered" | "canceled";

type LatLon = { lat: number; lon: number };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function isFiniteLatLon(p: any): p is LatLon {
  return (
    p &&
    typeof p === "object" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lon) <= 180
  );
}

function getCarto(style: MapStyle) {
  // Optional but recommended in production:
  // add NEXT_PUBLIC_STADIA_MAPS_KEY to your env
  const key =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_STADIA_MAPS_KEY || "").trim()
      : "";
  const q = key ? `?api_key=${encodeURIComponent(key)}` : "";

  // 🖋️ Crisp pen & ink vibe (Stamen Toner Lite via Stadia Maps)
  if (style === "ink-sketch") {
    return {
      url: `https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png${q}`,
      attribution:
        '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a> ' +
        '&copy; <a href="https://stamen.com/" target="_blank" rel="noreferrer">Stamen Design</a> ' +
        '&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> ' +
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    };
  }

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

/**
 * ✅ Fit bounds ONLY when origin/dest change (primitive deps)
 * ✅ Guard: do nothing unless coords are valid
 */
function FitBoundsOnRouteChange({ origin, dest }: { origin: LatLon; dest: LatLon }) {
  const map = useMap();
  const didFitKey = useRef<string>("");

  useEffect(() => {
    if (!isFiniteLatLon(origin) || !isFiniteLatLon(dest)) return;

    const key = `${origin.lat.toFixed(6)},${origin.lon.toFixed(6)}|${dest.lat.toFixed(6)},${dest.lon.toFixed(6)}`;
    if (didFitKey.current === key) return;

    didFitKey.current = key;

    const bounds: [number, number][] = [
      [origin.lat, origin.lon],
      [dest.lat, dest.lon],
    ];

    map.fitBounds(bounds as any, { padding: [30, 30] });
  }, [map, origin.lat, origin.lon, dest.lat, dest.lon]);

  return null;
}

/** Keep tooltips sane + always include "Location:" */
function normalizeTooltip(text?: string) {
  let t = (text || "").trim();
  if (!t) return "Location: Somewhere over the U.S.";

  t = t.replace(/^currently over:\s*/i, "").trim();
  if (!/^location:\s*/i.test(t)) t = `Location: ${t}`;
  return t;
}

/** tiny deterministic "random" from coords so each route gets its own vibe */
function seedFromCoords(o: LatLon, d: LatLon) {
  const n = Math.sin(o.lat * 12.9898 + o.lon * 78.233 + d.lat * 37.719 + d.lon * 11.131) * 43758.5453;
  return n - Math.floor(n); // 0..1
}

/**
 * Build a "near-straight" path with tiny perpendicular drift.
 * - Static at a given progress value (depends on progress, not time)
 * - Drift grows gently with distance traveled
 */
function makeNearStraightDriftPath(args: { origin: LatLon; dest: LatLon; progress: number; points?: number }) {
  const { origin, dest } = args;
  const steps = Math.max(18, args.points ?? 56);
  const p = clamp01(args.progress);

  const A = { x: origin.lon, y: origin.lat };
  const B = { x: dest.lon, y: dest.lat };

  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dist = Math.hypot(dx, dy);

  // perpendicular unit
  const px = -dy;
  const py = dx;
  const plen = Math.hypot(px, py) || 1;
  const ux = px / plen;
  const uy = py / plen;

  const s = seedFromCoords(origin, dest);

  // subtle scale clamp
  const base = Math.min(0.06, Math.max(0.01, dist * 0.0012));
  const travelGain = 0.35 + 0.65 * Math.sqrt(p);

  const pts: [number, number][] = [];
  const N = Math.max(2, Math.floor(steps * p));

  for (let i = 0; i <= N; i++) {
    const t = (i / Math.max(1, N)) * p;

    const x0 = A.x + dx * t;
    const y0 = A.y + dy * t;

    const w =
      Math.sin((t * 8 + s * 3 + p * 1.3) * Math.PI * 2) * 0.55 +
      Math.sin((t * 3.5 + s * 7 + p * 0.7) * Math.PI * 2) * 0.35 +
      Math.sin((t * 13 + s * 11 + p * 2.1) * Math.PI * 2) * 0.1;

    const taper = Math.sin(Math.PI * (i / Math.max(1, N)));
    const off = base * travelGain * taper * w;

    const x = x0 + ux * off;
    const y = y0 + uy * off;

    pts.push([y, x]); // [lat, lon]
  }

  if (pts.length === 0) pts.push([origin.lat, origin.lon]);

  return pts;
}

/**
 * ✅ Dev-only: build sleeping segments along the route based on sent/eta time.
 * This is a *visual aid* (overlay), not the authoritative sim.
 *
 * ✅ IMPORTANT: respects your "skip initial sleep window" policy
 * by treating [sent..skipUntil) as awake.
 */
function buildSleepOverlaySegments(args: { origin: LatLon; dest: LatLon; sentAtISO?: string; etaAtISO?: string; samples?: number }) {
  const sentMs = args.sentAtISO ? Date.parse(args.sentAtISO) : NaN;
  const etaMs = args.etaAtISO ? Date.parse(args.etaAtISO) : NaN;

  if (!Number.isFinite(sentMs) || !Number.isFinite(etaMs) || etaMs <= sentMs) return [];

  // Use MIDPOINT offset as the server does (consistency > per-point “accuracy” here)
  const midLon = (args.origin.lon + args.dest.lon) / 2;
  const offMin = offsetMinutesFromLon(midLon);

  // If sending during sleep, policy says: skip this first sleep window
  const skipUntil = initialSleepSkipUntilUtcMs(sentMs, offMin) ?? null;

  const N = Math.max(48, args.samples ?? 140);
  const segments: [number, number][][] = [];
  let current: [number, number][] = [];

  const push = () => {
    if (current.length >= 2) segments.push(current);
    current = [];
  };

  for (let i = 0; i <= N; i++) {
    const f = i / N; // 0..1 time fraction (baseline)
    const tMs = sentMs + (etaMs - sentMs) * f;

    // Treat initial skipped window as awake
    const sleeping = skipUntil && tMs < skipUntil ? false : isSleepingAt(tMs, offMin);

    const lat = lerp(args.origin.lat, args.dest.lat, f);
    const lon = lerp(args.origin.lon, args.dest.lon, f);
    const pt: [number, number] = [lat, lon];

    if (sleeping) current.push(pt);
    else push();
  }

  push();
  return segments;
}

export default function MapView(props: {
  origin?: LatLon;
  dest?: LatLon;
  progress: number; // 0..1
  tooltipText?: string;
  mapStyle?: MapStyle;
  markerMode?: MarkerMode;

  // ✅ optional dev-only overlay inputs
  sentAtISO?: string;
  etaAtISO?: string;
  bird?: "pigeon" | "snipe" | "goose";
}) {
  // ✅ Hard guard: never crash the page if coords are missing/bad
  if (!isFiniteLatLon(props.origin) || !isFiniteLatLon(props.dest)) {
    return (
      <div className="mapShell" style={{ display: "grid", placeItems: "center", minHeight: 260 }}>
        <div className="muted" style={{ textAlign: "center", padding: 16 }}>
          Map unavailable (missing route coordinates).
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>No worries — the bird is still real.</div>
        </div>
      </div>
    );
  }

  const origin = props.origin;
  const dest = props.dest;

  const mapStyle: MapStyle = props.mapStyle ?? "carto-positron";
  const tile = useMemo(() => getCarto(mapStyle), [mapStyle]);

  // ✅ smooth progress display with RAF (race-proof)
  const [displayProgress, setDisplayProgress] = useState(() => clamp01(props.progress));
  const displayRef = useRef(displayProgress);
  useEffect(() => {
    displayRef.current = displayProgress;
  }, [displayProgress]);

  const rafRef = useRef<number | null>(null);

  const mode: MarkerMode = props.markerMode ?? (clamp01(props.progress) >= 1 ? "delivered" : "flying");

  const isFlying = mode === "flying";
  const isSleeping = mode === "sleeping";
  const isDelivered = mode === "delivered";
  const isCanceled = mode === "canceled";

  // ✅ dev-only overlay toggle (?sleep=1)
  const [showSleepOverlay, setShowSleepOverlay] = useState(false);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setShowSleepOverlay(sp.get("sleep") === "1");
    } catch {
      setShowSleepOverlay(false);
    }
  }, []);

  // ✅ smooth marker progress (skip animation for terminal canceled/delivered)
  useEffect(() => {
    const to = clamp01(props.progress);

    if (isCanceled || isDelivered) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setDisplayProgress(to);
      return;
    }

    const from = displayRef.current;
    if (Math.abs(to - from) < 0.00001) return;

    const durationMs = 420;
    const start = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = clamp01((now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = lerp(from, to, eased);
      setDisplayProgress(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [props.progress, isCanceled, isDelivered]);

  const current = useMemo(
    () => ({
      lat: lerp(origin.lat, dest.lat, displayProgress),
      lon: lerp(origin.lon, dest.lon, displayProgress),
    }),
    [origin.lat, origin.lon, dest.lat, dest.lon, displayProgress]
  );

  const liveIcon = useMemo(
    () =>
      L.divIcon({
        className: `pigeonMarker ${isFlying ? "live" : ""} ${isSleeping ? "sleep" : ""} ${isDelivered ? "delivered" : ""} ${
          isCanceled ? "canceled" : ""
        }`,
        html: `
          <div class="pigeonPulseWrap">
            <span class="pigeonPulseRing"></span>
            <span class="pigeonPulseRing ring2"></span>
            <span class="pigeonSleepRing"></span>
            ${isCanceled ? `<div class="pigeonSkull" aria-hidden="true">💀</div>` : `<div class="pigeonDot"></div>`}
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
    [isFlying, isSleeping, isDelivered, isCanceled]
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

  const straightLine: [number, number][] = useMemo(
    () => [
      [origin.lat, origin.lon],
      [dest.lat, dest.lon],
    ],
    [origin.lat, origin.lon, dest.lat, dest.lon]
  );

  const flownPts = useMemo(() => {
    const p = clamp01(displayProgress);
    if (p <= 0.0001) return [[origin.lat, origin.lon]] as [number, number][];
    return makeNearStraightDriftPath({ origin, dest, progress: p, points: 60 });
  }, [origin, dest, displayProgress]);

  const sleepSegments = useMemo(() => {
    if (!showSleepOverlay) return [];
    return buildSleepOverlaySegments({
      origin,
      dest,
      sentAtISO: props.sentAtISO,
      etaAtISO: props.etaAtISO,
      samples: 170,
    });
  }, [showSleepOverlay, origin, dest, props.sentAtISO, props.etaAtISO]);

  const tooltip = useMemo(() => normalizeTooltip(props.tooltipText), [props.tooltipText]);

  // ✅ CSS-variable based colors
  const idealColor = "var(--route-ideal, rgba(18,18,18,0.35))";
  const flownColor = "var(--route-flown, rgba(22,163,74,0.85))";
  const sleepColor = "var(--route-sleep, rgba(88,80,236,0.85))";

  return (
    <div className="mapShell">
      <MapContainer zoom={4} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution={tile.attribution} url={tile.url} />

        <FitBoundsOnRouteChange origin={origin} dest={dest} />

        <Polyline positions={straightLine} pathOptions={{ color: idealColor, weight: 3, opacity: 1 }} />

        <Polyline
          positions={flownPts}
          pathOptions={{
            color: flownColor,
            weight: 3,
            opacity: 1,
            dashArray: "2 10",
            lineCap: "round",
            lineJoin: "round",
          }}
        />

        {showSleepOverlay &&
          sleepSegments.map((seg, i) => (
            <Polyline
              key={`sleep-${i}`}
              positions={seg as any}
              pathOptions={{
                color: sleepColor,
                weight: 5,
                opacity: 0.55,
                dashArray: "10 10",
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          ))}

        <Marker position={[origin.lat, origin.lon]} icon={originIcon} />
        <Marker position={[dest.lat, dest.lon]} icon={destIcon} />

        <Marker position={[current.lat, current.lon]} icon={liveIcon}>
        <Tooltip
  direction="top"
  offset={[0, isSleeping ? -30 : -26]}
  opacity={1}
  permanent
  interactive={false}
  className={`pigeonTooltip ${isFlying ? "live" : ""} ${isSleeping ? "sleep" : ""} ${isDelivered ? "delivered" : ""} ${
    isCanceled ? "canceled" : ""
  }`}
>
  <span className="pigeonTooltipRow">
    {isCanceled ? (
      <span className="pigeonStatusGlyph" aria-hidden>
        💀
      </span>
    ) : !isDelivered ? (
      <span className={`pigeonLiveDot ${isSleeping ? "sleep" : ""}`} />
    ) : null}

    <span className="pigeonTooltipText">{tooltip}</span>
  </span>
</Tooltip>
        </Marker>
      </MapContainer>
    </div>
  );
}