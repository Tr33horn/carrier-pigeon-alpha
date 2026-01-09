"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

// ✅ Sleep helpers (client-safe)
import {
  offsetMinutesFromLon,
  isSleepingAt,
  nextWakeUtcMs,
  sleepUntilLocalText,
  type SleepConfig,
} from "@/app/lib/flightSleep";

// ✅ Match the LetterStatusPage values
export type MapStyle = "carto-positron" | "carto-voyager" | "carto-positron-nolabels";
export type MarkerMode = "flying" | "sleeping" | "delivered" | "canceled";

type LatLon = { lat: number; lon: number };

// Optional bird types (used only for sleep config overlay)
export type BirdType = "pigeon" | "snipe" | "goose";

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
function makeNearStraightDriftPath(args: {
  origin: LatLon;
  dest: LatLon;
  progress: number; // 0..1
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

/* -------------------------------------------------
   ✅ Sleep overlay helpers (dev-only)
------------------------------------------------- */

const SLEEP_BY_BIRD: Record<BirdType, SleepConfig> = {
  pigeon: { sleepStartHour: 22, sleepEndHour: 6 },
  goose: { sleepStartHour: 21, sleepEndHour: 7 },
  snipe: { sleepStartHour: 0, sleepEndHour: 0 }, // never sleeps
};

function parseIsoToMs(iso?: string) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function localClockText(utcMs: number, offsetMin: number) {
  const localMs = utcMs + offsetMin * 60_000;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(localMs));
}

/**
 * Build polylines for segments that are "sleeping" at estimated time along route.
 * Uses linear time interpolation between sentAt and etaAt purely for visualization.
 * (Your real model is sleep-aware, but this overlay is just a neat dev lens.)
 */
function buildSleepSegments(args: {
  origin: LatLon;
  dest: LatLon;
  sentAtMs: number;
  etaAtMs: number;
  cfg: SleepConfig;
  samplePoints?: number;
}) {
  const { origin, dest, sentAtMs, etaAtMs, cfg } = args;
  const N = Math.max(24, args.samplePoints ?? 80);

  if (!Number.isFinite(sentAtMs) || !Number.isFinite(etaAtMs) || etaAtMs <= sentAtMs) return [];

  // create points along straight line (sleep overlay shouldn’t drift; it’s “debug truth”)
  const pts: { lat: number; lon: number; utcMs: number; sleeping: boolean }[] = [];

  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const lat = lerp(origin.lat, dest.lat, t);
    const lon = lerp(origin.lon, dest.lon, t);
    const utcMs = sentAtMs + (etaAtMs - sentAtMs) * t;

    const offsetMin = offsetMinutesFromLon(lon);
    const sleeping = isSleepingAt(utcMs, offsetMin, cfg);

    pts.push({ lat, lon, utcMs, sleeping });
  }

  // group contiguous sleeping points into polylines
  const segments: [number, number][][] = [];
  let cur: [number, number][] = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.sleeping) {
      cur.push([p.lat, p.lon]);
    } else {
      if (cur.length >= 2) segments.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) segments.push(cur);

  return segments;
}

export default function MapView(props: {
  origin?: LatLon;
  dest?: LatLon;
  progress: number; // 0..1
  tooltipText?: string;
  mapStyle?: MapStyle;
  markerMode?: MarkerMode; // "flying" | "sleeping" | "delivered" | "canceled"

  // ✅ Optional sleep overlay inputs (backwards compatible)
  sentAtISO?: string; // letter.sent_at
  etaAtISO?: string;  // letter.eta_at
  bird?: BirdType | null;
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

  const [displayProgress, setDisplayProgress] = useState(() => clamp01(props.progress));
  const rafRef = useRef<number | null>(null);

  // ✅ Mode derived from prop (source of truth) + fallback to progress
  const mode: MarkerMode = props.markerMode ?? (clamp01(props.progress) >= 1 ? "delivered" : "flying");

  const isFlying = mode === "flying";
  const isSleeping = mode === "sleeping";
  const isDelivered = mode === "delivered";
  const isCanceled = mode === "canceled";

  // ✅ smooth marker progress (skip animation for terminal canceled/delivered)
  useEffect(() => {
    const to = clamp01(props.progress);

    // If terminal, just snap.
    if (isCanceled || isDelivered) {
      setDisplayProgress(to);
      return;
    }

    const from = displayProgress;
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
  }, [props.progress, isCanceled, isDelivered]);

  const current = useMemo(
    () => ({
      lat: lerp(origin.lat, dest.lat, displayProgress),
      lon: lerp(origin.lon, dest.lon, displayProgress),
    }),
    [origin.lat, origin.lon, dest.lat, dest.lon, displayProgress]
  );

  // ✅ CANCELED: render skull marker instead of dot
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

            ${
              isCanceled
                ? `<div class="pigeonSkull" aria-hidden="true">💀</div>`
                : `<div class="pigeonDot"></div>`
            }
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

  // ✅ flown route uses displayProgress (same thing the marker uses)
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

  /**
   * ✅ Don’t hardcode colors in JS.
   * Use CSS variables with fallbacks so your theme can control it.
   */
  const idealColor = "var(--route-ideal, rgba(18,18,18,0.35))";
  const flownColor = "var(--route-flown, rgba(22,163,74,0.85))";

  // -----------------------------
  // ✅ Dev-only sleep overlay toggle
  // -----------------------------
  const [overlayOn, setOverlayOn] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      setOverlayOn(sp.get("sleep") === "1");
    } catch {
      // ignore
    }
  }, []);

  const bird: BirdType = props.bird === "goose" || props.bird === "snipe" ? props.bird : "pigeon";
  const cfg = SLEEP_BY_BIRD[bird];

  const offsetMin = useMemo(() => offsetMinutesFromLon(current.lon), [current.lon]);

  const sleepNow = useMemo(() => isSleepingAt(Date.now(), offsetMin, cfg), [offsetMin, cfg]);
  const nextWake = useMemo(() => nextWakeUtcMs(Date.now(), offsetMin, cfg), [offsetMin, cfg]);

  const sentAtMs = useMemo(() => parseIsoToMs(props.sentAtISO), [props.sentAtISO]);
  const etaAtMs = useMemo(() => parseIsoToMs(props.etaAtISO), [props.etaAtISO]);

  const sleepSegments = useMemo(() => {
    if (!overlayOn) return [];
    if (!sentAtMs || !etaAtMs) return [];
    return buildSleepSegments({
      origin,
      dest,
      sentAtMs,
      etaAtMs,
      cfg,
      samplePoints: 90,
    });
  }, [overlayOn, sentAtMs, etaAtMs, origin, dest, cfg]);

  // Route overlay colors (CSS vars w/ fallbacks)
  const sleepColor = "var(--route-sleep, rgba(99,102,241,0.70))"; // indigo-ish fallback

  return (
    <div className="mapShell" style={{ position: "relative" }}>
      {/* ✅ Dev-only overlay HUD */}
      {overlayOn && (
        <div
          style={{
            position: "absolute",
            zIndex: 1000,
            top: 10,
            left: 10,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            fontSize: 12,
            lineHeight: 1.25,
            maxWidth: 260,
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Sleep overlay</div>
            <div style={{ opacity: 0.7 }}>{bird}</div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div>
              Local time: <strong>{localClockText(Date.now(), offsetMin)}</strong>{" "}
              <span style={{ opacity: 0.75 }}>(UTC{offsetMin >= 0 ? "+" : ""}{Math.round(offsetMin / 60)})</span>
            </div>

            <div style={{ marginTop: 6 }}>
              Window:{" "}
              <strong>
                {cfg.sleepStartHour}:00 → {cfg.sleepEndHour}:00
              </strong>{" "}
              <span style={{ opacity: 0.75 }}>(local)</span>
            </div>

            <div style={{ marginTop: 6 }}>
              Status:{" "}
              <strong style={{ color: sleepNow ? "rgba(99,102,241,0.95)" : "rgba(22,163,74,0.95)" }}>
                {sleepNow ? "sleeping 💤" : "awake 🫡"}
              </strong>
            </div>

            {sleepNow && nextWake ? (
              <div style={{ marginTop: 6, opacity: 0.85 }}>
                Wakes: <strong>{sleepUntilLocalText(nextWake, offsetMin)}</strong>
              </div>
            ) : null}

            <div style={{ marginTop: 8, opacity: 0.7 }}>
              Tip: toggle via <code>?sleep=1</code>
            </div>
          </div>
        </div>
      )}

      <MapContainer zoom={4} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution={tile.attribution} url={tile.url} />

        <FitBoundsOnRouteChange origin={origin} dest={dest} />

        {/* Ideal straight line route */}
        <Polyline
          positions={straightLine}
          pathOptions={{
            color: idealColor,
            weight: 3,
            opacity: 1,
          }}
        />

        {/* ✅ Sleep segments overlay (dev-only) */}
        {overlayOn &&
          sleepSegments.map((seg, idx) => (
            <Polyline
              key={`sleep-${idx}`}
              positions={seg as any}
              pathOptions={{
                color: sleepColor,
                weight: 4,
                opacity: 1,
                dashArray: "1 8",
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          ))}

        {/* Actual flown route so far (subtle drift) */}
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