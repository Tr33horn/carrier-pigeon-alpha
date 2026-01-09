import { NextResponse } from "next/server";
import crypto from "crypto";
import React from "react";
import { supabaseServer } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email/send";

// ✅ Geo label system
import { ROUTE_TUNED_REGIONS } from "../../../lib/geo/geoRegions.routes";
import { geoLabelFor, type GeoRegion } from "../../../lib/geo/geoLabel";

// ✅ Sleep realism helpers (already in your repo)
import {
  offsetMinutesFromLon,
  isSleepingAt,
  nextWakeUtcMs,
  etaFromRequiredAwakeMs,
} from "../../../lib/flightSleep";

// ✅ Email template
import { LetterOnTheWayEmail } from "@/emails/LetterOnTheWay";

// ✅ Toggle this ON only after you add DB columns:
//   letter_checkpoints.region_id (text)
//   letter_checkpoints.region_kind (text)
const STORE_REGION_META = false;

const REGIONS: GeoRegion[] = [...ROUTE_TUNED_REGIONS];

type BirdType = "pigeon" | "snipe" | "goose";

type SleepCfg = { sleepStartHour: number; sleepEndHour: number };

const BIRDS: Record<
  BirdType,
  { label: string; speed_kmh: number; inefficiency: number; sleepCfg: SleepCfg; ignoresSleep: boolean }
> = {
  pigeon: {
    label: "Homing Pigeon",
    speed_kmh: 72,
    inefficiency: 1.15,
    sleepCfg: { sleepStartHour: 22, sleepEndHour: 6 },
    ignoresSleep: false,
  },
  snipe: {
    label: "Great Snipe",
    speed_kmh: 88,
    inefficiency: 1.05,
    sleepCfg: { sleepStartHour: 22, sleepEndHour: 6 }, // irrelevant
    ignoresSleep: true, // ✅ the real switch
  },
  goose: {
    label: "Canada Goose",
    speed_kmh: 56,
    inefficiency: 1.2,
    sleepCfg: { sleepStartHour: 21, sleepEndHour: 7 },
    ignoresSleep: false,
  },
};

function normalizeBird(raw: unknown): BirdType {
  const b = String(raw || "").toLowerCase();
  if (b === "snipe") return "snipe";
  if (b === "goose") return "goose";
  return "pigeon";
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(x));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Simple email check */
function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** ✅ One true UTC formatter (match cron) */
function formatUtc(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(d);
}

/** ✅ Base URL helper for absolute links in emails */
function getBaseUrl(req: Request) {
  const envBase = process.env.APP_URL || process.env.APP_BASE_URL;
  if (envBase && envBase.trim()) return envBase.trim();

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

function joinUrl(base: string, pathOrUrl: string) {
  if (!pathOrUrl) return base;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
}

/**
 * Sticky endpoints:
 * - Near destination: prefer a "metro" region around the destination if present.
 */
function stickyGeoLabel(opts: {
  lat: number;
  lon: number;
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  progress: number; // 0..1
  regions: GeoRegion[];
}) {
  const { lat, lon, dest, progress, regions } = opts;

  const base = geoLabelFor(lat, lon, regions);

  const nearDest = progress >= 0.88;
  if (!nearDest) return base;

  let bestMetro: GeoRegion | null = null;

  for (const r of regions) {
    if (r.kind !== "metro") continue;

    const b = r.bbox;
    const inBbox = lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
    if (!inBbox) continue;

    const dKm = distanceKm(dest.lat, dest.lon, lat, lon);

    if (!bestMetro) {
      bestMetro = r;
      (bestMetro as any).__dKm = dKm;
      continue;
    }

    const bestD = (bestMetro as any).__dKm as number;
    if (dKm < bestD) {
      bestMetro = r;
      (bestMetro as any).__dKm = dKm;
    }
  }

  if (!bestMetro) return base;

  return {
    text: `Over ${bestMetro.name}`,
    regionId: bestMetro.id,
    kind: bestMetro.kind,
  };
}

/**
 * ✅ Checkpoints that respect sleep:
 * - Position is linear (vibe)
 * - Time is mapped by “required awake ms” → UTC using flightSleep’s etaFromRequiredAwakeMs
 *
 * IMPORTANT: We DO NOT store sleep-adjusted ETA in DB anymore.
 * DB stores baseline eta_at; status API computes sleep-adjusted display ETA.
 */
function generateCheckpointsSleepAware(opts: {
  sentUtcMs: number;
  requiredAwakeMsTotal: number;
  offsetMin: number;
  sleepCfg: SleepCfg;
  ignoresSleep: boolean;
  oLat: number;
  oLon: number;
  dLat: number;
  dLon: number;
}) {
  const { sentUtcMs, requiredAwakeMsTotal, offsetMin, sleepCfg, ignoresSleep, oLat, oLon, dLat, dLon } = opts;

  const count = 8;

  const fallback = [
    "Departed roost",
    "Cruising altitude",
    "Tailwind acquired",
    "Crossing the plains",
    "Snack break (imaginary)",
    "Over the mountains",
    "Approaching destination",
    "Final descent",
  ];

  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);

    const lat = lerp(oLat, dLat, t);
    const lon = lerp(oLon, dLon, t);

    const reqAwakeForCheckpoint = Math.round(requiredAwakeMsTotal * t);

    const atUtcMs = ignoresSleep
      ? sentUtcMs + reqAwakeForCheckpoint
      : etaFromRequiredAwakeMs(sentUtcMs, reqAwakeForCheckpoint, offsetMin, sleepCfg);

    const at = new Date(atUtcMs).toISOString();

    const geo = stickyGeoLabel({
      lat,
      lon,
      origin: { lat: oLat, lon: oLon },
      dest: { lat: dLat, lon: dLon },
      progress: t,
      regions: REGIONS,
    });

    const name =
      i === 0
        ? "Departed roost"
        : i === count - 1
        ? "Final descent"
        : geo?.text || fallback[i] || `Checkpoint ${i + 1}`;

    return {
      idx: i,
      name,
      lat,
      lon,
      at,
      region_id: geo?.regionId ?? null,
      region_kind: geo?.kind ?? null,
    };
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const {
    from_name,
    from_email,
    to_name,
    to_email,
    subject,
    message,
    origin,
    destination,
    bird: birdRaw,
  } = body;

  const bird = normalizeBird(birdRaw);
  const birdCfg = BIRDS[bird];

  const normalizedFromEmail = typeof from_email === "string" ? from_email.trim().toLowerCase() : "";
  const normalizedToEmail = typeof to_email === "string" ? to_email.trim().toLowerCase() : "";

  if (!normalizedFromEmail || !normalizedToEmail) {
    return NextResponse.json({ error: "Sender and recipient email are required." }, { status: 400 });
  }
  if (!isEmailValid(normalizedFromEmail)) {
    return NextResponse.json({ error: "Sender email looks invalid." }, { status: 400 });
  }
  if (!isEmailValid(normalizedToEmail)) {
    return NextResponse.json({ error: "Recipient email looks invalid." }, { status: 400 });
  }

  if (
    !origin ||
    !destination ||
    !isFiniteNumber(origin.lat) ||
    !isFiniteNumber(origin.lon) ||
    !isFiniteNumber(destination.lat) ||
    !isFiniteNumber(destination.lon)
  ) {
    return NextResponse.json({ error: "Origin and destination are required." }, { status: 400 });
  }

  if (origin.name === destination.name) {
    return NextResponse.json({ error: "Origin and destination must be different." }, { status: 400 });
  }

  // ✅ Distance + required awake flight duration (no sleep baked in)
  const km = distanceKm(origin.lat, origin.lon, destination.lat, destination.lon);

  const speedKmh = birdCfg.speed_kmh;
  const reqAwakeMs = Math.max(
    0,
    Math.round(((km / speedKmh) * birdCfg.inefficiency) * 3600_000)
  );

  // ✅ Pick a single timezone offset for the flight
  const midLon = lerp(origin.lon, destination.lon, 0.5);
  const offsetMin = offsetMinutesFromLon(midLon);

  // ✅ If launch happens during sleep window, SKIP this sleep cycle:
  // store sent_at at next wake, not “now”
  const requestedSentUtcMs = Date.now();

  const sleepingNow =
    birdCfg.ignoresSleep ? false : isSleepingAt(requestedSentUtcMs, offsetMin, birdCfg.sleepCfg);

  const wakeUtcMs =
    birdCfg.ignoresSleep ? null : nextWakeUtcMs(requestedSentUtcMs, offsetMin, birdCfg.sleepCfg);

  const actualSentUtcMs = sleepingNow && wakeUtcMs ? wakeUtcMs : requestedSentUtcMs;

  const sentAt = new Date(actualSentUtcMs);

  // ✅ BASELINE ETA stored in DB (always sane):
  // (sleep-adjusted ETA is computed in /api/letters/[token])
  const etaBaselineUtcMs = actualSentUtcMs + reqAwakeMs;
  const etaAt = new Date(etaBaselineUtcMs);

  // ✅ Hard safety: if something is wildly wrong, clamp to baseline within 30 days.
  // This prevents “2039” ever getting written again.
  const maxAllowedUtcMs = actualSentUtcMs + 30 * 24 * 3600_000;
  const etaAtSafe = Number.isFinite(etaBaselineUtcMs) && etaBaselineUtcMs <= maxAllowedUtcMs
    ? etaAt
    : new Date(Math.min(etaBaselineUtcMs || maxAllowedUtcMs, maxAllowedUtcMs));

  const publicToken = crypto.randomBytes(16).toString("hex");

  // 🔎 Debug that will immediately tell us if sleep-skip is triggering
  console.log("SEND DEBUG:", {
    token: publicToken.slice(0, 8),
    bird,
    km: Number(km.toFixed(2)),
    speedKmh,
    ineff: birdCfg.inefficiency,
    reqAwakeMs,
    offsetMin,
    requestedSentUtc: new Date(requestedSentUtcMs).toISOString(),
    sleepingNow,
    wakeUtc: wakeUtcMs ? new Date(wakeUtcMs).toISOString() : null,
    actualSentUtc: sentAt.toISOString(),
    etaBaselineUtc: etaAtSafe.toISOString(),
  });

  const { data: letter, error: letterErr } = await supabaseServer
    .from("letters")
    .insert({
      public_token: publicToken,
      bird,
      from_name,
      from_email: normalizedFromEmail,
      sender_receipt_sent_at: null,
      to_name,
      to_email: normalizedToEmail,
      delivered_notified_at: null,
      subject,
      body: message,
      origin_name: origin.name,
      origin_lat: origin.lat,
      origin_lon: origin.lon,
      dest_name: destination.name,
      dest_lat: destination.lat,
      dest_lon: destination.lon,
      distance_km: km,
      speed_kmh: speedKmh,
      sent_at: sentAt.toISOString(),
      eta_at: etaAtSafe.toISOString(),
    })
    .select("id, public_token, eta_at, origin_name, dest_name, from_name, to_name, bird")
    .single();

  if (letterErr || !letter) {
    return NextResponse.json({ error: letterErr?.message ?? "Insert failed" }, { status: 500 });
  }

  // ✅ Sleep-aware checkpoints (their times pause during sleep)
  const checkpoints = generateCheckpointsSleepAware({
    sentUtcMs: actualSentUtcMs,
    requiredAwakeMsTotal: reqAwakeMs,
    offsetMin,
    sleepCfg: birdCfg.sleepCfg,
    ignoresSleep: birdCfg.ignoresSleep,
    oLat: origin.lat,
    oLon: origin.lon,
    dLat: destination.lat,
    dLon: destination.lon,
  });

  const { error: cpErr } = await supabaseServer.from("letter_checkpoints").insert(
    checkpoints.map((cp) => {
      const baseRow: any = {
        letter_id: letter.id,
        idx: cp.idx,
        name: cp.name,
        lat: cp.lat,
        lon: cp.lon,
        at: cp.at,
      };

      if (STORE_REGION_META) {
        baseRow.region_id = cp.region_id;
        baseRow.region_kind = cp.region_kind;
      }

      return baseRow;
    })
  );

  if (cpErr) {
    return NextResponse.json({ error: cpErr.message }, { status: 500 });
  }

  // ✅ Send “On the way” email (ABSOLUTE status URL + debugToken)
  try {
    const baseUrl = getBaseUrl(req);
    const statusPath = `/l/${publicToken}`;
    const absoluteStatusUrl = joinUrl(baseUrl, statusPath);
    const etaTextUtc = formatUtc(letter.eta_at);

    const result = await sendEmail({
      to: normalizedToEmail,
      subject: "A letter is on the way",
      react: React.createElement(LetterOnTheWayEmail as any, {
        toName: letter.to_name,
        fromName: letter.from_name,
        originName: letter.origin_name || origin.name || "Origin",
        destName: letter.dest_name || destination.name || "Destination",
        etaTextUtc,
        statusUrl: absoluteStatusUrl,
        bird: (letter.bird as BirdType) || bird,
        debugToken: publicToken,
      }),
      tags: [
        { name: "kind", value: "letter_on_the_way" },
        { name: "token", value: publicToken },
      ],
    });

    if (result && "error" in (result as any) && (result as any).error) {
      console.error("RESEND SEND FAILED", {
        letterToken: publicToken,
        to: normalizedToEmail,
        error: (result as any).error,
      });
    } else {
      console.log("RESEND SEND OK", {
        letterToken: publicToken,
        to: normalizedToEmail,
      });
    }
  } catch (e) {
    console.error("ON THE WAY EMAIL ERROR:", {
      letterToken: publicToken,
      to: normalizedToEmail,
      error: (e as any)?.message ?? String(e),
    });
  }

  return NextResponse.json({ public_token: publicToken, eta_at: letter.eta_at });
}