import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "../../../lib/supabaseServer";
import { Resend } from "resend";

// ✅ Geo label system
import { ROUTE_TUNED_REGIONS } from "../../../lib/geo/geoRegions.routes";
import { geoLabelFor, type GeoRegion } from "../../../lib/geo/geoLabel";

// ✅ Toggle this ON only after you add DB columns:
//   letter_checkpoints.region_id (text)
//   letter_checkpoints.region_kind (text)
const STORE_REGION_META = false;

const REGIONS: GeoRegion[] = [
  ...ROUTE_TUNED_REGIONS,
];

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

/** Simple email check (same vibe as your client validation) */
function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** ✅ One true UTC formatter (match the cron file) */
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

/* -------------------------------------------------
   ✅ Bird attributes (POC)
   - speed_kmh: cruising-ish speed
   - roost_hours: nightly downtime (0 = nonstop)
   - inefficiency: your old REST_FACTOR lives here
------------------------------------------------- */

type BirdType = "pigeon" | "snipe" | "goose";

const BIRDS: Record<
  BirdType,
  { label: string; emoji: string; speed_kmh: number; roost_hours: number; inefficiency: number }
> = {
  // Baseline: classic pigeon, rests overnight
  pigeon: { label: "Homing Pigeon", emoji: "🕊️", speed_kmh: 72, roost_hours: 8, inefficiency: 1.15 },

  // Fast long-haul: no roosting for our POC "express" bird
  snipe: { label: "Great Snipe", emoji: "🏎️", speed_kmh: 88, roost_hours: 0, inefficiency: 1.05 },

  // Heavy/group vibe: slower and longer nightly roost
  goose: { label: "Canada Goose", emoji: "🪿", speed_kmh: 56, roost_hours: 10, inefficiency: 1.20 },
};

function normalizeBird(raw: unknown): BirdType {
  const b = String(raw || "").toLowerCase();
  if (b === "snipe") return "snipe";
  if (b === "goose") return "goose";
  return "pigeon";
}

/**
 * Compute total travel hours with:
 * - base flight time = distance / speed
 * - inefficiency multiplier (wind, pauses, etc.)
 * - roosting: bird flies (24 - roost_hours) per day, then must roost roost_hours
 */
function estimateTravelHours(distanceKm: number, bird: BirdType) {
  const cfg = BIRDS[bird];

  // base flight hours + realism fudge
  const flightHours = (distanceKm / cfg.speed_kmh) * cfg.inefficiency;

  // nonstop bird
  if (cfg.roost_hours <= 0) return flightHours;

  const awakeHours = 24 - cfg.roost_hours;
  if (awakeHours <= 0) return flightHours;

  // Each full awake block implies a roost afterwards.
  // Example: if flightHours = 33, awakeHours=16 => 2 full blocks => 2 roosts.
  const fullAwakeBlocks = Math.floor(flightHours / awakeHours);
  const roostHours = fullAwakeBlocks * cfg.roost_hours;

  return flightHours + roostHours;
}

/**
 * Sticky endpoints:
 * - Near destination: prefer a "metro" region around the destination if present.
 * - Near origin: we still keep your fun "Departed roost" label for idx=0.
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

  // Default resolver (bbox priority)
  const base = geoLabelFor(lat, lon, regions);

  // "Sticky" zone near destination: last ~12% of flight
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

function generateCheckpoints(
  sentAt: Date,
  etaAt: Date,
  oLat: number,
  oLon: number,
  dLat: number,
  dLon: number
) {
  const count = 8;
  const totalMs = etaAt.getTime() - sentAt.getTime();

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
    const at = new Date(sentAt.getTime() + totalMs * t).toISOString();

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
    bird: birdRaw, // ✅ NEW
  } = body;

  const bird = normalizeBird(birdRaw);
  const birdCfg = BIRDS[bird];

  // --- Server-side required-field enforcement ---
  const normalizedFromEmail =
    typeof from_email === "string" ? from_email.trim() : "";
  const normalizedToEmail =
    typeof to_email === "string" ? to_email.trim() : "";

  if (!normalizedFromEmail || !normalizedToEmail) {
    return NextResponse.json(
      { error: "Sender and recipient email are required." },
      { status: 400 }
    );
  }

  if (!isEmailValid(normalizedFromEmail)) {
    return NextResponse.json(
      { error: "Sender email looks invalid." },
      { status: 400 }
    );
  }

  if (!isEmailValid(normalizedToEmail)) {
    return NextResponse.json(
      { error: "Recipient email looks invalid." },
      { status: 400 }
    );
  }

  if (!origin?.lat || !origin?.lon || !destination?.lat || !destination?.lon) {
    return NextResponse.json(
      { error: "Origin and destination are required." },
      { status: 400 }
    );
  }

  if (origin.name === destination.name) {
    return NextResponse.json(
      { error: "Origin and destination must be different." },
      { status: 400 }
    );
  }

  // ✅ Bird-based ETA
  const km = distanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const hours = estimateTravelHours(km, bird);
  const ms = Math.round(hours * 60 * 60 * 1000);

  const sentAt = new Date();
  const etaAt = new Date(sentAt.getTime() + ms);
  const publicToken = crypto.randomBytes(16).toString("hex");

  const { data: letter, error: letterErr } = await supabaseServer
    .from("letters")
    .insert({
      public_token: publicToken,
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
      speed_kmh: birdCfg.speed_kmh, // ✅ store chosen speed (no schema change)
      sent_at: sentAt.toISOString(),
      eta_at: etaAt.toISOString(),
      // NOTE: Not storing `bird` yet to avoid breaking DB schema.
    })
    .select("id, public_token, eta_at")
    .single();

  if (letterErr || !letter) {
    return NextResponse.json(
      { error: letterErr?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  const checkpoints = generateCheckpoints(
    sentAt,
    etaAt,
    origin.lat,
    origin.lon,
    destination.lat,
    destination.lon
  );

  const { error: cpErr } = await supabaseServer
    .from("letter_checkpoints")
    .insert(
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

  // Send "Bird launched" email immediately
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("Missing RESEND_API_KEY");
    const resend = new Resend(key);

    const base = process.env.APP_BASE_URL || "http://localhost:3000";
    const statusUrl = `${base}/l/${publicToken}`;

    const etaText = formatUtc(letter.eta_at);

    await resend.emails.send({
      from: process.env.MAIL_FROM || "FLOK <no-reply@localhost>",
      to: normalizedToEmail,
      subject: `${birdCfg.emoji} A sealed letter is on the way`,
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
          <h2 style="margin: 0 0 8px">${birdCfg.emoji} A ${birdCfg.label} has departed.</h2>
          <p style="margin: 0 0 12px">
            You have a letter from <strong>${from_name || "Someone"}</strong>.
            It stays sealed until delivery.
          </p>
          <p style="margin: 0 0 12px"><strong>ETA (UTC):</strong> ${etaText}</p>
          <p style="margin: 0 0 16px">
            <a href="${statusUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
              Track flight status
            </a>
          </p>
          <p style="opacity: 0.7; margin: 0">
            (No peeking. The bird is watching.)
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error("LAUNCH EMAIL ERROR:", e);
  }

  return NextResponse.json({ public_token: publicToken, eta_at: letter.eta_at });
}