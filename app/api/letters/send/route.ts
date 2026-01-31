import { NextResponse } from "next/server";
import crypto from "crypto";
import { createElement } from "react";
import { supabaseServer } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email/send";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";

// ✅ Geo label system
import { ROUTE_TUNED_REGIONS } from "../../../lib/geo/geoRegions.routes";
import { geoLabelFor, type GeoRegion } from "../../../lib/geo/geoLabel";

// ✅ Sleep helper (only used here to pick a stable flight “timezone” offset)
import { offsetMinutesFromLon } from "@/app/lib/flightSleep";

// ✅ Single source of truth for bird rules
import { BIRD_RULES, normalizeBird, type BirdType } from "@/app/lib/birds";

// ✅ Bird catalog: seal policy + allowed/default/fixed seal ids live here
import { getBirdCatalog } from "@/app/lib/birdsCatalog";

// ✅ Seals registry: validates the seal id exists
import { getSeal } from "@/app/lib/seals";
import { normalizeEnvelopeTint } from "@/app/lib/envelopeTints";

// ✅ Email template
import { LetterOnTheWayEmail } from "@/emails/LetterOnTheWay";

// ✅ Toggle this ON only after you add DB columns:
//   letter_checkpoints.region_id (text)
//   letter_checkpoints.region_kind (text)
const STORE_REGION_META = false;

const REGIONS: GeoRegion[] = [...ROUTE_TUNED_REGIONS];

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

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

function titleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function deriveNameFromEmail(email: string) {
  const local = email.split("@")[0] || "";
  const cleaned = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? titleCase(cleaned) : "You";
}

function normalizeFromName(input: unknown, fallback: string) {
  if (typeof input !== "string") return fallback;
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 80);
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
 * ✅ Stable checkpoints:
 * - Position is linear (vibe)
 * - Time is baseline wall-time between sent_at and eta_at (no sleep baked in)
 */
function generateCheckpointsBaseline(opts: {
  sentUtcMs: number;
  etaUtcMs: number;
  oLat: number;
  oLon: number;
  dLat: number;
  dLon: number;
}) {
  const { sentUtcMs, etaUtcMs, oLat, oLon, dLat, dLon } = opts;

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

  const span = Math.max(1, etaUtcMs - sentUtcMs);

  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);

    const lat = lerp(oLat, dLat, t);
    const lon = lerp(oLon, dLon, t);

    const atUtcMs = sentUtcMs + Math.round(span * t);
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

/* ---------------------------------
   ✅ Seal resolution + validation
--------------------------------- */
function resolveSealId(opts: { bird: BirdType; requestedSealId: unknown }) {
  const { bird, requestedSealId } = opts;

  const row = getBirdCatalog(bird) ?? getBirdCatalog("pigeon");
  const sealPolicy = (row as any)?.sealPolicy ?? "selectable";

  const req = typeof requestedSealId === "string" ? requestedSealId.trim() : "";
  const reqId = req || null;

  // Birds with no seal concept
  if (sealPolicy === "none") {
    return { ok: true as const, sealId: null as string | null };
  }

  // Fixed seal: ignore user choice, force the bird’s seal
  if (sealPolicy === "fixed") {
    const fixed = ((row as any)?.fixedSealId as string | null | undefined) ?? null;
    if (!fixed) return { ok: false as const, error: "This bird requires a fixed seal, but none is configured." };
    if (!getSeal(fixed)) return { ok: false as const, error: `Fixed seal "${fixed}" is not registered.` };
    return { ok: true as const, sealId: fixed };
  }

  // Selectable seals
  const allowed = Array.isArray((row as any)?.allowedSealIds) ? ((row as any).allowedSealIds as string[]) : [];
  const def = ((row as any)?.defaultSealId as string | null | undefined) ?? null;

  // If client didn't send anything, pick default (or first allowed)
  const chosen = reqId || def || allowed[0] || null;
  if (!chosen) return { ok: false as const, error: "No seal is available for this bird." };

  // Ensure the seal exists
  if (!getSeal(chosen)) return { ok: false as const, error: `Seal "${chosen}" is not registered.` };

  // If allowed list is present, enforce it
  if (allowed.length > 0 && !allowed.includes(chosen)) {
    return { ok: false as const, error: "That seal isn’t allowed for this bird." };
  }

  return { ok: true as const, sealId: chosen };
}

export async function POST(req: Request) {
  const authClient = await createSupabaseServerReadClient();
  const { data: authData } = await authClient.auth.getUser();
  const user = authData?.user ?? null;
  if (!user) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }
  const userEmail = user.email ? user.email.trim().toLowerCase() : "";
  if (!userEmail || !isEmailValid(userEmail)) {
    return NextResponse.json({ error: "Sender email missing or invalid." }, { status: 400 });
  }

  const body = await req.json();

  // ✅ NEW: accept seal_id from client
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
    seal_id,
    envelope_tint,
    stationery_id,
    delivery_type,
    postcard_template_id,
  } = body;
  const content = typeof message === "string" ? message : (typeof body?.body === "string" ? body.body : "");

  const bird: BirdType = normalizeBird(birdRaw);
  const birdCfg = BIRD_RULES[bird];
  const envelopeTint = normalizeEnvelopeTint(envelope_tint);
  const deliveryType = delivery_type === "postcard" ? "postcard" : "letter";
  const postcardTemplateId =
    typeof postcard_template_id === "string" && postcard_template_id.trim() ? postcard_template_id.trim() : null;
  const stationeryId =
    deliveryType === "letter" && typeof stationery_id === "string" && stationery_id.trim() ? stationery_id.trim() : null;

  // ✅ Resolve/validate seal before insert
  const sealResolved =
    deliveryType === "postcard"
      ? { ok: true as const, sealId: null as string | null }
      : resolveSealId({ bird, requestedSealId: seal_id });
  if (!sealResolved.ok) {
    return NextResponse.json({ error: sealResolved.error }, { status: 400 });
  }

  const normalizedFromEmail = typeof from_email === "string" ? from_email.trim().toLowerCase() : "";
  const normalizedToEmail = typeof to_email === "string" ? to_email.trim().toLowerCase() : "";

  if (process.env.NODE_ENV !== "production" && normalizedFromEmail && normalizedFromEmail !== userEmail) {
    console.log("SEND EMAIL OVERRIDE:", { fromEmailClient: normalizedFromEmail ? "present" : "missing" });
  }
  if (!normalizedToEmail) {
    return NextResponse.json({ error: "Recipient email is required." }, { status: 400 });
  }
  if (!isEmailValid(normalizedToEmail)) {
    return NextResponse.json({ error: "Recipient email looks invalid." }, { status: 400 });
  }

  const meta = (user.user_metadata as Record<string, string> | null) ?? null;
  const metaName = meta?.full_name || meta?.name || "";
  const derivedName = metaName?.trim() || deriveNameFromEmail(userEmail);
  const normalizedFromName = normalizeFromName(from_name, derivedName);

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

  if (origin.lat === destination.lat && origin.lon === destination.lon) {
    return NextResponse.json({ error: "Origin and destination must be different." }, { status: 400 });
  }

  // ✅ Distance + required awake flight duration (no sleep baked in)
  const km = distanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
  if (!Number.isFinite(km) || km <= 0) {
    return NextResponse.json({ error: "Invalid route distance." }, { status: 400 });
  }

  // ✅ SPEED IS DEFINED IN CODE (birds.ts)
  const speedKmhEffective = Number(birdCfg.speedKmh);
  if (!Number.isFinite(speedKmhEffective) || speedKmhEffective <= 0) {
    return NextResponse.json({ error: "Invalid bird speed." }, { status: 400 });
  }

  const reqAwakeMs = Math.max(0, Math.round(((km / speedKmhEffective) * birdCfg.inefficiency) * 3600_000));

  // ✅ Pick a single timezone offset for the flight (MIDPOINT lon)
  const midLon = lerp(origin.lon, destination.lon, 0.5);
  const offsetMin = offsetMinutesFromLon(midLon);
  const sleepCfg = birdCfg.sleepCfg;

  // ✅ IMPORTANT: Do NOT delay sent_at for sleep.
  const sentUtcMs = Date.now();
  const sentAt = new Date(sentUtcMs);

  // ✅ Baseline ETA stored in DB (always sane)
  const etaUtcMs = sentUtcMs + reqAwakeMs;

  // ✅ Safety belt: don’t allow ETAs beyond 365 days
  const maxAllowedUtcMs = sentUtcMs + 365 * 24 * 3600_000;
  const etaUtcMsSafe = Number.isFinite(etaUtcMs) ? Math.min(etaUtcMs, maxAllowedUtcMs) : maxAllowedUtcMs;
  const etaAtSafe = new Date(etaUtcMsSafe);

  const publicToken = crypto.randomBytes(16).toString("hex");

  console.log("SEND STORE:", {
    bodyLen: content?.length ?? 0,
    messageLen: content?.length ?? 0,
  });

  console.log("SEND DEBUG:", {
    token: publicToken.slice(0, 8),
    bird,
    sealId: sealResolved.sealId,
    km: Number(km.toFixed(2)),
    speedKmh: speedKmhEffective,
    ineff: birdCfg.inefficiency,
    reqAwakeMs,
    offsetMin,
    sentUtc: sentAt.toISOString(),
    etaBaselineUtc: etaAtSafe.toISOString(),
  });

  const insertBase = {
    public_token: publicToken,
    bird,

    // ✅ NEW: store seal_id on the letter (requires DB column letters.seal_id)
    seal_id: sealResolved.sealId,
    envelope_tint: envelopeTint,
    sleep_offset_min: offsetMin,
    sleep_start_hour: sleepCfg?.sleepStartHour ?? null,
    sleep_end_hour: sleepCfg?.sleepEndHour ?? null,
    sender_user_id: user.id,

    from_name: normalizedFromName,
    from_email: userEmail,
    sender_receipt_sent_at: null,
    to_name,
    to_email: normalizedToEmail,
    delivered_notified_at: null,
    subject,
    body: content,
    message: content,
    origin_name: origin.name,
    origin_lat: origin.lat,
    origin_lon: origin.lon,
    dest_name: destination.name,
    dest_lat: destination.lat,
    dest_lon: destination.lon,
    distance_km: km,

    // ✅ snapshot only (NOT authoritative)
    speed_kmh: speedKmhEffective,

    sent_at: sentAt.toISOString(),
    eta_at: etaAtSafe.toISOString(),
  };

  const optionalFields: Record<string, string> = {};
  if (stationeryId) optionalFields.stationery_id = stationeryId;
  if (deliveryType) optionalFields.delivery_type = deliveryType;
  if (postcardTemplateId && deliveryType === "postcard") optionalFields.postcard_template_id = postcardTemplateId;

  const missingColumn = (err: any, column: string) =>
    !!err &&
    (err.code === "42703" ||
      new RegExp(`\\b${column}\\b`, "i").test(err.message || "") ||
      new RegExp(`\\b${column}\\b`, "i").test(err.details || ""));

  let insertPayload: Record<string, any> = { ...insertBase, ...optionalFields };
  let { data: letter, error: letterErr } = await supabaseServer
    .from("letters")
    .insert(insertPayload)
    .select("id, public_token, eta_at, origin_name, dest_name, from_name, to_name, bird, seal_id")
    .single();

  if (letterErr && Object.keys(optionalFields).length > 0) {
    const remaining = { ...insertPayload };
    const keys = Object.keys(optionalFields);
    for (const key of keys) {
      if (!letterErr) break;
      if (missingColumn(letterErr, key)) {
        delete remaining[key];
        ({ data: letter, error: letterErr } = await supabaseServer
          .from("letters")
          .insert(remaining)
          .select("id, public_token, eta_at, origin_name, dest_name, from_name, to_name, bird, seal_id")
          .single());
      }
    }
  }

  if (letterErr || !letter) {
    return NextResponse.json({ error: letterErr?.message ?? "Insert failed" }, { status: 500 });
  }

  if (deliveryType === "postcard" && postcardTemplateId) {
    const { error: addonErr } = await supabaseServer.from("letter_items").upsert(
      [
        {
          letter_id: letter.id,
          kind: "addon",
          code: "postcard_template",
          title: "Postcard template",
          meta: { postcard_template_id: postcardTemplateId },
        },
      ],
      { onConflict: "letter_id,kind,code" }
    );
    if (addonErr) {
      console.warn("POSTCARD ADDON UPSERT ERROR:", addonErr);
    }
  }

  // ✅ Store baseline checkpoints (status route retimes them sleep-aware)
  const checkpoints = generateCheckpointsBaseline({
    sentUtcMs,
    etaUtcMs: etaUtcMsSafe,
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

  // ✅ Send “On the way” email
  try {
    const baseUrl = getBaseUrl(req);
    const statusPath = `/l/${publicToken}`;
    const absoluteStatusUrl = joinUrl(baseUrl, statusPath);
    const etaTextUtc = formatUtc(letter.eta_at);

    const result = await sendEmail({
      to: normalizedToEmail,
      subject: "A letter is on the way",
      react: createElement(LetterOnTheWayEmail as any, {
        toName: letter.to_name,
        fromName: letter.from_name,
        originName: letter.origin_name || origin.name || "Origin",
        destName: letter.dest_name || destination.name || "Destination",
        etaTextUtc,
        statusUrl: absoluteStatusUrl,
        bird: (letter.bird as BirdType) || bird,
        debugToken: publicToken,
        // optional to use later in template:
        sealId: (letter as any).seal_id ?? sealResolved.sealId,
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
