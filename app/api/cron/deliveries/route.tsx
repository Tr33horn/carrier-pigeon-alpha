import { NextResponse } from "next/server";
import React from "react";
import { supabaseServer } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email/send";

import { LetterDeliveredEmail } from "@/emails/LetterDelivered";
import { LetterProgressUpdateEmail } from "@/emails/LetterProgressUpdate";
import { DeliveryReceiptEmail } from "@/emails/DeliveryReceipt";

// ✅ Sleep realism helpers (already in your repo)
import {
  awakeMsBetween,
  offsetMinutesFromLon,
  type SleepConfig,
} from "../../../lib/flightSleep";

type BirdType = "pigeon" | "snipe" | "goose";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
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

function normalizeBird(raw: unknown): BirdType {
  const b = String(raw || "").toLowerCase();
  if (b === "snipe") return "snipe";
  if (b === "goose") return "goose";
  return "pigeon";
}

function getBaseUrl(req: Request) {
  const envBase = process.env.APP_URL || process.env.APP_BASE_URL;
  if (envBase && envBase.trim()) return envBase.trim();

  // Works on Vercel + local + most hosts
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}

/** Tiny helper: treat non-empty strings as true */
function bool(x: any) {
  return !!(x && String(x).trim());
}

/** ✅ Cron auth: supports Authorization: Bearer <secret>, x-cron-secret: <secret>, or ?secret=<secret> */
function isCronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return { ok: false, reason: "CRON_SECRET not set" as const };

  const auth = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";

  // Optional manual trigger via query param (still secret-gated)
  const url = new URL(req.url);
  const qSecret = url.searchParams.get("secret") || "";

  const expected = `Bearer ${secret}`;

  const ok = auth === expected || xSecret === secret || qSecret === secret;

  return { ok, reason: ok ? null : ("Unauthorized" as const) };
}

/* -------------------------------------------------
   ✅ Sleep config per bird (match your send route)
------------------------------------------------- */

const SLEEP_BY_BIRD: Record<BirdType, SleepConfig> = {
  pigeon: { sleepStartHour: 22, sleepEndHour: 6 }, // 10pm -> 6am
  goose: { sleepStartHour: 21, sleepEndHour: 7 },  // 9pm -> 7am
  snipe: { sleepStartHour: 0, sleepEndHour: 0 },   // never sleeping
};

function midpointLon(originLon?: number | null, destLon?: number | null) {
  if (typeof originLon !== "number" || typeof destLon !== "number") return null;
  if (!Number.isFinite(originLon) || !Number.isFinite(destLon)) return null;
  return (originLon + destLon) / 2;
}

/**
 * ✅ Sleep-aware progress:
 * Progress is based on "awake milliseconds elapsed" / "total awake milliseconds required".
 * Because your ETA is sleep-aware, totalAwake = awakeMsBetween(sent, eta, offset, cfg).
 */
function progressPctSleepAware(args: {
  sentISO: string;
  etaISO: string;
  nowMs: number;
  offsetMin: number;
  cfg: SleepConfig;
}) {
  const sent = Date.parse(args.sentISO);
  const eta = Date.parse(args.etaISO);
  const now = args.nowMs;

  if (!Number.isFinite(sent) || !Number.isFinite(eta) || eta <= sent) return 100;

  const end = Math.min(now, eta);

  const totalAwake = awakeMsBetween(sent, eta, args.offsetMin, args.cfg);
  if (totalAwake <= 0) {
    // If cfg says "never awake" (shouldn't happen), fallback to time-based
    return Math.round(clamp01((end - sent) / (eta - sent)) * 100);
  }

  const doneAwake = awakeMsBetween(sent, end, args.offsetMin, args.cfg);
  return Math.round(clamp01(doneAwake / totalAwake) * 100);
}

export async function GET(req: Request) {
  // --- auth ---
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

  /* --------------------------
     A) DELIVERIES
  -------------------------- */

  const { data: lettersToDeliver, error: deliverErr } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, eta_at, from_name, from_email, to_name, to_email, delivered_notified_at, sender_receipt_sent_at, origin_name, dest_name, subject, bird"
    )
    .is("delivered_notified_at", null)
    .lte("eta_at", nowISO);

  if (deliverErr) {
    return NextResponse.json({ error: deliverErr.message }, { status: 500 });
  }

  let delivered_recipient_emails = 0;
  let delivered_sender_receipts = 0;

  for (const letter of lettersToDeliver ?? []) {
    const statusPath = `/l/${letter.public_token}`;
    const absoluteStatusUrl = joinUrl(baseUrl, statusPath);
    const bird = normalizeBird((letter as any).bird);

    // Recipient delivered email — ✅ absolute URL
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

    // Always mark delivered_notified_at (even if no to_email)
    await supabaseServer.from("letters").update({ delivered_notified_at: nowISO }).eq("id", letter.id);

    // Sender receipt — ✅ absolute
    if (letter.from_email && !letter.sender_receipt_sent_at) {
      const deliveredAtUtc = formatUtc(nowISO);

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
     B) MID-FLIGHT UPDATES (25/50/75) — ✅ sleep-aware progress
  -------------------------- */

  const { data: inFlight, error: inflightErr } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, subject, from_name, to_email, sent_at, eta_at, progress_25_sent_at, progress_50_sent_at, progress_75_sent_at, bird, origin_lon, dest_lon"
    )
    .is("delivered_notified_at", null)
    .lte("sent_at", nowISO)
    .gt("eta_at", nowISO);

  if (inflightErr) {
    return NextResponse.json({ error: inflightErr.message }, { status: 500 });
  }

  // ✅ Optional debug: see why “eligible” letters didn’t trigger milestone sends
  const debug_inflight = (inFlight ?? []).map((l) => {
    const bird = normalizeBird((l as any).bird);
    const cfg = SLEEP_BY_BIRD[bird];

    const mid = midpointLon((l as any).origin_lon, (l as any).dest_lon);
    const offsetMin = offsetMinutesFromLon(mid ?? 0);

    const pct = progressPctSleepAware({
      sentISO: l.sent_at,
      etaISO: l.eta_at,
      nowMs,
      offsetMin,
      cfg,
    });

    return {
      token: (l.public_token || "").slice(0, 8),
      bird,
      offsetMin,
      pct,
      sent_at: l.sent_at,
      eta_at: l.eta_at,
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

  for (const letter of inFlight ?? []) {
    if (!letter.to_email) {
      midflight_skipped_no_email++;
      continue;
    }

    const bird = normalizeBird((letter as any).bird);
    const cfg = SLEEP_BY_BIRD[bird];

    // Use midpoint lon for stable “local time” vibe across the route
    const mid = midpointLon((letter as any).origin_lon, (letter as any).dest_lon);
    const offsetMin = offsetMinutesFromLon(mid ?? 0);

    const pct = progressPctSleepAware({
      sentISO: letter.sent_at,
      etaISO: letter.eta_at,
      nowMs,
      offsetMin,
      cfg,
    });

    const statusPath = `/l/${letter.public_token}`;
    const absoluteStatusUrl = joinUrl(baseUrl, statusPath);
    const etaUtcText = formatUtc(letter.eta_at);

    const sendUpdate = async (
      milestone: 25 | 50 | 75,
      column: "progress_25_sent_at" | "progress_50_sent_at" | "progress_75_sent_at"
    ) => {
      const subjectLine =
        milestone === 25
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

  return NextResponse.json({
    ok: true,
    ran_at: nowISO,
    deliveries: {
      eligible: (lettersToDeliver ?? []).length,
      delivered_recipient_emails,
      delivered_sender_receipts,
    },
    midflight: {
      eligible: (inFlight ?? []).length,
      sent_25: midflight_25,
      sent_50: midflight_50,
      sent_75: midflight_75,
      skipped_no_email: midflight_skipped_no_email,
    },
    ...(debug ? { debug_inflight } : {}),
  });
}