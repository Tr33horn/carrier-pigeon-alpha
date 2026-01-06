"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

export type MapStyle = "carto-positron" | "carto-voyager" | "carto-positron-nolabels";
export type MarkerMode = "flying" | "sleeping" | "delivered";

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

function FitBoundsOnRouteChange({
  origin,
  dest,
}: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
}) {
  const map = useMap();
  const didFitKey = useRef<string>("");

  useEffect(() => {
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

function normalizeTooltip(text?: string) {
  let t = (text || "").trim();
  if (!t) return "Location: Somewhere over the U.S.";

  t = t.replace(/^currently over:\s*/i, "").trim();
  if (!/^location:\s*/i.test(t)) t = `Location: ${t}`;
  return t;
}

function seedFromCoords(o: { lat: number; lon: number }, d: { lat: number; lon: number }) {
  const n = Math.sin(o.lat * 12.9898 + o.lon * 78.233 + d.lat * 37.719 + d.lon * 11.131) * 43758.5453;
  return n - Math.floor(n);
}

function makeNearStraightDriftPath(args: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  progress: number;
  points?: number;
}) {
  const { origin, dest } = args;
  const steps = Math.max(18, args.points ?? 56);
  const p = clamp01(args.progress);

  const A = { x: origin.lon, y: origin.lat };
  const B = { x: dest.lon, y: dest.lat };

  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const dist = Math.hypot(dx, dy);

  const px = -dy;
  const py = dx;
  const plen = Math.hypot(px, py) || 1;
  const ux = px / plen;
  const uy = py / plen;

  const s = seedFromCoords(origin, dest);

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

    pts.push([y, x]);
  }

  if (pts.length === 0) pts.push([origin.lat, origin.lon]);

  return pts;
}

export default function MapView(props: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  progress: number;
  tooltipText?: string;
  mapStyle?: MapStyle;
  markerMode?: MarkerMode;
}) {
  const { origin, dest } = props;

  const mapStyle: MapStyle = props.mapStyle ?? "carto-positron";
  const tile = useMemo(() => getCarto(mapStyle), [mapStyle]);

  const [displayProgress, setDisplayProgress] = useState(() => clamp01(props.progress));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayProgress;
    const to = clamp01(props.progress);

    if (Math.abs(to - from) < 0.00001) return;

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

  const current = useMemo(
    () => ({
      lat: lerp(origin.lat, dest.lat, displayProgress),
      lon: lerp(origin.lon, dest.lon, displayProgress),
    }),
    [origin.lat, origin.lon, dest.lat, dest.lon, displayProgress]
  );

  const mode: MarkerMode = props.markerMode ?? (clamp01(props.progress) >= 1 ? "delivered" : "flying");

  const isFlying = mode === "flying";
  const isSleeping = mode === "sleeping";
  const isDelivered = mode === "delivered";

  const liveIcon = useMemo(
    () =>
      L.divIcon({
        className: `pigeonMarker ${isFlying ? "live" : ""} ${isSleeping ? "sleep" : ""} ${isDelivered ? "delivered" : ""}`,
        html: `
          <div class="pigeonPulseWrap">
            <span class="pigeonPulseRing"></span>
            <span class="pigeonPulseRing ring2"></span>
            <span class="pigeonSleepRing"></span>
            <div class="pigeonDot"></div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
    [isFlying, isSleeping, isDelivered]
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
    return makeNearStraightDriftPath({
      origin,
      dest,
      progress: p,
      points: 60,
    });
  }, [origin, dest, displayProgress]);

  const tooltip = useMemo(() => normalizeTooltip(props.tooltipText), [props.tooltipText]);

  const idealColor = "var(--route-ideal, rgba(18,18,18,0.35))";
  const flownColor = "var(--route-flown, rgba(22,163,74,0.85))";

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

        <Marker position={[origin.lat, origin.lon]} icon={originIcon} />
        <Marker position={[dest.lat, dest.lon]} icon={destIcon} />

        <Marker position={[current.lat, current.lon]} icon={liveIcon}>
          <Tooltip
            direction="top"
            offset={[0, -10]}
            opacity={1}
            permanent
            interactive={false}
            className={`pigeonTooltip ${isFlying ? "live" : ""} ${isSleeping ? "sleep" : ""} ${isDelivered ? "delivered" : ""}`}
          >
            <span className="pigeonTooltipRow">
              {!isDelivered && <span className={`pigeonLiveDot ${isSleeping ? "sleep" : ""}`} />}
              <span className="pigeonTooltipText">{tooltip}</span>
            </span>
          </Tooltip>
        </Marker>
      </MapContainer>
    </div>
  );
}