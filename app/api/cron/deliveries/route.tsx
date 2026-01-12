import { NextResponse } from "next/server";
import React from "react";
import { supabaseServer } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email/send";

import { LetterDeliveredEmail } from "@/emails/LetterDelivered";
import { LetterProgressUpdateEmail } from "@/emails/LetterProgressUpdate";
import { DeliveryReceiptEmail } from "@/emails/DeliveryReceipt";

// ✅ geo helpers (to create “Over Seattle Metro”, etc)
import { checkpointGeoText, geoRegionForPoint } from "../../../lib/geo";

// ✅ Shared sleep logic (same behavior as /api/letters/[token])
import {
  offsetMinutesFromLon,
  awakeMsBetween,
  etaFromRequiredAwakeMs,
  initialSleepSkipUntilUtcMs,
  type SleepConfig,
} from "@/app/lib/flightSleep";

// ✅ Single source of truth for bird rules
import { BIRD_RULES, normalizeBird, type BirdType } from "@/app/lib/birds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -------------------- tiny helpers -------------------- */

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Format an ISO date as a UTC string (consistent everywhere) */
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

function joinUrl(base: string, pathOrUrl: string) {
  if (!pathOrUrl) return base;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
}

function getBaseUrl(req: Request) {
  const envBase = process.env.APP_URL || process.env.APP_BASE_URL;
  if (envBase && envBase.trim()) return envBase.trim();

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

/** Tiny helper: treat non-empty strings as true */
function bool(x: any) {
  return !!(x && String(x).trim());
}

/** ✅ Cron auth */
function isCronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return { ok: false, reason: "CRON_SECRET not set" as const };

  const auth = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";

  const url = new URL(req.url);
  const qSecret = url.searchParams.get("secret") || "";

  const expected = `Bearer ${secret}`;
  const ok = auth === expected || xSecret === secret || qSecret === secret;

  return { ok, reason: ok ? null : ("Unauthorized" as const) };
}

function midpointLon(originLon?: number | null, destLon?: number | null) {
  if (typeof originLon !== "number" || typeof destLon !== "number") return null;
  if (!Number.isFinite(originLon) || !Number.isFinite(destLon)) return null;
  return (originLon + destLon) / 2;
}

/* -------------------------------------------------
   ✅ Shared “initial sleep skip” logic (same as token route)
------------------------------------------------- */

function computeInitialSleepSkip(sentMs: number, offsetMin: number, cfg: SleepConfig, ignoresSleep: boolean) {
  if (ignoresSleep) return { skipUntilMs: null as number | null };
  if (!Number.isFinite(sentMs)) return { skipUntilMs: null as number | null };

  const wake = initialSleepSkipUntilUtcMs(sentMs, offsetMin, cfg);
  if (!wake || !Number.isFinite(wake) || wake <= sentMs) return { skipUntilMs: null };

  return { skipUntilMs: wake };
}

function awakeMsBetweenWithSkip(
  startMs: number,
  endMs: number,
  offsetMin: number,
  cfg: SleepConfig,
  skipUntilMs: number | null,
  ignoresSleep: boolean
) {
  if (endMs <= startMs) return 0;
  if (ignoresSleep) return endMs - startMs;

  if (skipUntilMs && startMs < skipUntilMs) {
    const a = startMs;
    const b = Math.min(endMs, skipUntilMs);
    const awakeInSkip = Math.max(0, b - a);

    if (endMs <= skipUntilMs) return awakeInSkip;

    return awakeInSkip + awakeMsBetween(skipUntilMs, endMs, offsetMin, cfg);
  }

  return awakeMsBetween(startMs, endMs, offsetMin, cfg);
}

function etaFromRequiredAwakeMsWithSkip(
  sentMs: number,
  requiredAwakeMs: number,
  offsetMin: number,
  cfg: SleepConfig,
  skipUntilMs: number | null,
  ignoresSleep: boolean
) {
  if (requiredAwakeMs <= 0) return sentMs;
  if (ignoresSleep) return sentMs + requiredAwakeMs;

  if (skipUntilMs && sentMs < skipUntilMs) {
    const initialAwakeBudget = skipUntilMs - sentMs;
    if (requiredAwakeMs <= initialAwakeBudget) return sentMs + requiredAwakeMs;

    const remaining = requiredAwakeMs - initialAwakeBudget;
    return etaFromRequiredAwakeMs(skipUntilMs, remaining, offsetMin, cfg);
  }

  return etaFromRequiredAwakeMs(sentMs, requiredAwakeMs, offsetMin, cfg);
}

/* -------------------------------------------------
   ✅ Compute adjusted ETA + sleep-aware progress (same as token route)
------------------------------------------------- */

function computeAdjustedEtaAndPct(args: {
  sent_at: string;
  eta_at: string; // fallback if computation fails
  distance_km: any;
  speed_kmh: any;
  origin_lon: any;
  dest_lon: any;
  bird: BirdType;
  nowMs: number;
}) {
  const sentMs = Date.parse(args.sent_at);

  const originLon = Number(args.origin_lon);
  const destLon = Number(args.dest_lon);

  const midLon = midpointLon(originLon, destLon);
  const offsetMin = offsetMinutesFromLon(midLon ?? 0);

  const birdRule = BIRD_RULES[args.bird];
  const ignoresSleep = birdRule.ignoresSleep;
  const sleepCfg = birdRule.sleepCfg;

  const speedKmh = Number(args.speed_kmh);
  const distanceKm = Number(args.distance_km);

  const requiredAwakeMs =
    Number.isFinite(speedKmh) && speedKmh > 0 && Number.isFinite(distanceKm) && distanceKm > 0
      ? (distanceKm / speedKmh) * birdRule.inefficiency * 3600_000
      : 0;

  const { skipUntilMs } = computeInitialSleepSkip(sentMs, offsetMin, sleepCfg, ignoresSleep);

  const etaAdjustedMs =
    Number.isFinite(sentMs) && requiredAwakeMs > 0
      ? etaFromRequiredAwakeMsWithSkip(sentMs, requiredAwakeMs, offsetMin, sleepCfg, skipUntilMs, ignoresSleep)
      : Date.parse(args.eta_at);

  const safeEtaAdjustedMs = Number.isFinite(etaAdjustedMs) ? etaAdjustedMs : Date.parse(args.eta_at);
  const endMs = Math.min(args.nowMs, safeEtaAdjustedMs);

  const awakeSoFar =
    Number.isFinite(sentMs) && args.nowMs > sentMs && Number.isFinite(endMs)
      ? awakeMsBetweenWithSkip(sentMs, endMs, offsetMin, sleepCfg, skipUntilMs, ignoresSleep)
      : 0;

  const progress01 = requiredAwakeMs > 0 ? clamp01(awakeSoFar / requiredAwakeMs) : 1;
  const pct = Math.round(progress01 * 100);

  return {
    pct,
    etaAdjustedMs: safeEtaAdjustedMs,
    etaAdjustedISO: Number.isFinite(safeEtaAdjustedMs) ? new Date(safeEtaAdjustedMs).toISOString() : args.eta_at,
    offsetMin,
  };
}

/**
 * ✅ Location text at a given fraction of route.
 * Prefers named region labels; falls back to generic “Over …”.
 */
function overTextForFrac(args: {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  frac01: number;
}) {
  const { originLat, originLon, destLat, destLon } = args;
  if (![originLat, originLon, destLat, destLon].every((n) => typeof n === "number" && Number.isFinite(n))) return null;

  const t = clamp01(args.frac01);
  const lat = lerp(originLat, destLat, t);
  const lon = lerp(originLon, destLon, t);

  const region = geoRegionForPoint(lat, lon);
  if (region?.label) return `Over ${region.label}`;

  const geo = checkpointGeoText(lat, lon);
  if (!geo) return null;
  return /^over\s+/i.test(geo) ? geo.replace(/^over\s+/i, "Over ") : `Over ${geo}`;
}

export async function GET(req: Request) {
  const authCheck = isCronAuthorized(req);
  if (!authCheck.ok) {
    return NextResponse.json(
      { error: authCheck.reason },
      { status: authCheck.reason === "CRON_SECRET not set" ? 500 : 401 }
    );
  }

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  const baseUrl = getBaseUrl(req);
  const nowISO = new Date().toISOString();
  const nowMs = Date.now();

  // Lookahead window solves “adjusted ETA earlier than eta_at” edge-case
  // (e.g. initial sleep skip makes delivery earlier than stored eta_at)
  const LOOKAHEAD_MS = 48 * 3600_000;
  const lookaheadISO = new Date(nowMs + LOOKAHEAD_MS).toISOString();

  /* --------------------------
     A) DELIVERIES (✅ adjusted ETA)
  -------------------------- */

  const { data: deliverCandidates, error: deliverErr } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, eta_at, sent_at, distance_km, speed_kmh, from_name, from_email, to_name, to_email, delivered_notified_at, sender_receipt_sent_at, origin_name, dest_name, subject, bird, origin_lon, dest_lon, archived_at, canceled_at"
    )
    .is("delivered_notified_at", null)
    .is("archived_at", null)
    .is("canceled_at", null)
    // grab anything that *might* be due (covers adjusted earlier-than-stored eta_at)
    .lte("eta_at", lookaheadISO);

  if (deliverErr) {
    return NextResponse.json({ error: deliverErr.message }, { status: 500 });
  }

  let delivered_recipient_emails = 0;
  let delivered_sender_receipts = 0;
  let deliveries_eligible = 0;

  for (const letter of deliverCandidates ?? []) {
    const bird: BirdType = normalizeBird((letter as any).bird);

    // compute adjusted ETA exactly like status route
    const { etaAdjustedMs, etaAdjustedISO } = computeAdjustedEtaAndPct({
      sent_at: (letter as any).sent_at,
      eta_at: (letter as any).eta_at,
      distance_km: (letter as any).distance_km,
      speed_kmh: (letter as any).speed_kmh,
      origin_lon: (letter as any).origin_lon,
      dest_lon: (letter as any).dest_lon,
      bird,
      nowMs,
    });

    if (!Number.isFinite(etaAdjustedMs) || nowMs < etaAdjustedMs) continue;

    deliveries_eligible++;

    const statusPath = `/l/${letter.public_token}`;
    const absoluteStatusUrl = joinUrl(baseUrl, statusPath);

    // recipient email
    if (letter.to_email) {
      await sendEmail({
        to: letter.to_email,
        subject: letter.subject?.trim() ? `Delivered: ${letter.subject.trim()}` : "Your letter has arrived",
        react: (
          <LetterDeliveredEmail
            toName={letter.to_name}
            fromName={letter.from_name}
            statusUrl={absoluteStatusUrl}
            originName={letter.origin_name || "Origin"}
            destName={letter.dest_name || "Destination"}
            bird={bird}
          />
        ),
        tags: [
          { name: "kind", value: "delivered_recipient" },
          { name: "token", value: String(letter.public_token || "") },
        ],
      });

      delivered_recipient_emails++;
    }

    // mark delivered notified (timestamp = now)
    await supabaseServer.from("letters").update({ delivered_notified_at: nowISO }).eq("id", letter.id);

    // sender receipt
    if (letter.from_email && !letter.sender_receipt_sent_at) {
      const deliveredAtUtc = formatUtc(etaAdjustedISO || nowISO);

      await sendEmail({
        to: letter.from_email,
        subject: "Delivery receipt: confirmed",
        react: (
          <DeliveryReceiptEmail
            toName={letter.to_name}
            deliveredAtUtc={deliveredAtUtc}
            statusUrl={absoluteStatusUrl}
            bird={bird}
          />
        ),
        tags: [
          { name: "kind", value: "delivery_receipt_sender" },
          { name: "token", value: String(letter.public_token || "") },
        ],
      });

      await supabaseServer.from("letters").update({ sender_receipt_sent_at: nowISO }).eq("id", letter.id);
      delivered_sender_receipts++;
    }
  }

  /* --------------------------
     B) MID-FLIGHT UPDATES (25/50/75) — ✅ same progress math as UI
  -------------------------- */

  const { data: inFlight, error: inflightErr } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, subject, from_name, to_email, sent_at, eta_at, distance_km, speed_kmh, progress_25_sent_at, progress_50_sent_at, progress_75_sent_at, bird, origin_lon, dest_lon, origin_lat, dest_lat, origin_name, dest_name, archived_at, canceled_at"
    )
    .is("delivered_notified_at", null)
    .is("archived_at", null)
    .is("canceled_at", null)
    .lte("sent_at", nowISO)
    // keep query sane; we rely on adjusted ETA checks below
    .gt("eta_at", new Date(nowMs - 7 * 24 * 3600_000).toISOString());

  if (inflightErr) {
    return NextResponse.json({ error: inflightErr.message }, { status: 500 });
  }

  const debug_inflight = (inFlight ?? []).map((l) => {
    const bird: BirdType = normalizeBird((l as any).bird);

    const { pct, etaAdjustedISO } = computeAdjustedEtaAndPct({
      sent_at: (l as any).sent_at,
      eta_at: (l as any).eta_at,
      distance_km: (l as any).distance_km,
      speed_kmh: (l as any).speed_kmh,
      origin_lon: (l as any).origin_lon,
      dest_lon: (l as any).dest_lon,
      bird,
      nowMs,
    });

    const overText = overTextForFrac({
      originLat: Number((l as any).origin_lat),
      originLon: Number((l as any).origin_lon),
      destLat: Number((l as any).dest_lat),
      destLon: Number((l as any).dest_lon),
      frac01: pct / 100,
    });

    return {
      token: (l.public_token || "").slice(0, 8),
      bird,
      pct,
      etaAdjustedISO,
      overText,
      has_to_email: !!l.to_email,
      p25: bool((l as any).progress_25_sent_at),
      p50: bool((l as any).progress_50_sent_at),
      p75: bool((l as any).progress_75_sent_at),
    };
  });

  let midflight_25 = 0;
  let midflight_50 = 0;
  let midflight_75 = 0;
  let midflight_skipped_no_email = 0;
  let midflight_skipped_already_delivered = 0;

  for (const letter of inFlight ?? []) {
    if (!letter.to_email) {
      midflight_skipped_no_email++;
      continue;
    }

    const bird: BirdType = normalizeBird((letter as any).bird);

    const { pct, etaAdjustedMs, etaAdjustedISO } = computeAdjustedEtaAndPct({
      sent_at: (letter as any).sent_at,
      eta_at: (letter as any).eta_at,
      distance_km: (letter as any).distance_km,
      speed_kmh: (letter as any).speed_kmh,
      origin_lon: (letter as any).origin_lon,
      dest_lon: (letter as any).dest_lon,
      bird,
      nowMs,
    });

    // if adjusted ETA says it should be delivered, skip updates
    if (Number.isFinite(etaAdjustedMs) && nowMs >= etaAdjustedMs) {
      midflight_skipped_already_delivered++;
      continue;
    }

    const overText = overTextForFrac({
      originLat: Number((letter as any).origin_lat),
      originLon: Number((letter as any).origin_lon),
      destLat: Number((letter as any).dest_lat),
      destLon: Number((letter as any).dest_lon),
      frac01: pct / 100,
    });

    const statusPath = `/l/${letter.public_token}`;
    const absoluteStatusUrl = joinUrl(baseUrl, statusPath);

    // IMPORTANT: use adjusted ETA for the displayed UTC time (matches status route)
    const etaUtcText = formatUtc(etaAdjustedISO || (letter as any).eta_at);

    const sendUpdate = async (
      milestone: 25 | 50 | 75,
      column: "progress_25_sent_at" | "progress_50_sent_at" | "progress_75_sent_at"
    ) => {
      const subjectLine = overText
        ? `${overText} · Flight update`
        : milestone === 25
        ? "Update: 25% of the way there"
        : milestone === 50
        ? "Update: Halfway there"
        : "Update: 75% complete (incoming)";

      const funLine =
        milestone === 25
          ? "The courier has left the parking lot."
          : milestone === 50
          ? "Mid-flight snack negotiations successful."
          : "You may now hear faint wing sounds in the distance.";

      await sendEmail({
        to: letter.to_email!,
        subject: subjectLine,
        react: (
          <LetterProgressUpdateEmail
            milestone={milestone}
            pct={pct}
            fromName={letter.from_name}
            statusUrl={absoluteStatusUrl}
            etaTextUtc={etaUtcText}
            funLine={funLine}
            bird={bird}
            overText={overText} // ✅ preferred prop (email supports back-compat too)
          />
        ),
        tags: [
          { name: "kind", value: `progress_${milestone}` },
          { name: "token", value: String(letter.public_token || "") },
        ],
      });

      await supabaseServer.from("letters").update({ [column]: nowISO }).eq("id", letter.id);
    };

    if (pct >= 75 && !letter.progress_75_sent_at) {
      await sendUpdate(75, "progress_75_sent_at");
      midflight_75++;
      continue;
    }

    if (pct >= 50 && !letter.progress_50_sent_at) {
      await sendUpdate(50, "progress_50_sent_at");
      midflight_50++;
      continue;
    }

    if (pct >= 25 && !letter.progress_25_sent_at) {
      await sendUpdate(25, "progress_25_sent_at");
      midflight_25++;
      continue;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      ran_at: nowISO,

      deliveries: {
        candidates: (deliverCandidates ?? []).length,
        eligible_by_adjusted_eta: deliveries_eligible,
        delivered_recipient_emails,
        delivered_sender_receipts,
      },

      midflight: {
        eligible: (inFlight ?? []).length,
        sent_25: midflight_25,
        sent_50: midflight_50,
        sent_75: midflight_75,
        skipped_no_email: midflight_skipped_no_email,
        skipped_already_delivered_by_adjusted_eta: midflight_skipped_already_delivered,
      },

      ...(debug ? { debug_inflight } : {}),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}