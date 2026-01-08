import { NextResponse } from "next/server";
import React from "react";
import { supabaseServer } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email/send";

import { LetterDeliveredEmail } from "@/emails/LetterDelivered";
import { LetterProgressUpdateEmail } from "@/emails/LetterProgressUpdate";
import { DeliveryReceiptEmail } from "@/emails/DeliveryReceipt";

type BirdType = "pigeon" | "snipe" | "goose";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function progressPct(sentISO: string, etaISO: string) {
  const sent = Date.parse(sentISO);
  const eta = Date.parse(etaISO);
  const now = Date.now();
  if (!Number.isFinite(sent) || !Number.isFinite(eta) || eta <= sent) return 100;
  return Math.round(clamp01((now - sent) / (eta - sent)) * 100);
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

/** ✅ Cron auth: Vercel will send Authorization: Bearer <CRON_SECRET> on cron runs (when CRON_SECRET is set). */
function isCronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return { ok: false, reason: "CRON_SECRET not set" as const };

  const auth = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";

  // Optional manual trigger via query param (still secret-gated)
  const url = new URL(req.url);
  const qSecret = url.searchParams.get("secret") || "";

  const expected = `Bearer ${secret}`;

  const ok =
    auth === expected ||
    xSecret === secret ||
    qSecret === secret;

  return { ok, reason: ok ? null : ("Unauthorized" as const) };
}

export async function GET(req: Request) {
  // --- auth ---
  const authCheck = isCronAuthorized(req);
  if (!authCheck.ok) {
    // If CRON_SECRET isn't set, cron invocations will *always* 401 — super common setup gotcha.
    return NextResponse.json(
      { error: authCheck.reason },
      { status: authCheck.reason === "CRON_SECRET not set" ? 500 : 401 }
    );
  }

  const baseUrl = getBaseUrl(req);
  const nowISO = new Date().toISOString();

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

    // Recipient delivered email (template) — ✅ absolute URL
    if (letter.to_email) {
      await sendEmail({
        to: letter.to_email,
        subject: letter.subject?.trim()
          ? `Delivered: ${letter.subject.trim()}`
          : "Your letter has arrived",
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
      });

      delivered_recipient_emails++;
    }

    // Always mark delivered_notified_at (even if no to_email)
    await supabaseServer.from("letters").update({ delivered_notified_at: nowISO }).eq("id", letter.id);

    // Sender receipt (template) — ✅ already absolute, keep it
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
      });

      await supabaseServer.from("letters").update({ sender_receipt_sent_at: nowISO }).eq("id", letter.id);
      delivered_sender_receipts++;
    }
  }

  /* --------------------------
     B) MID-FLIGHT UPDATES (25/50/75)
  -------------------------- */

  const { data: inFlight, error: inflightErr } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, subject, from_name, to_email, sent_at, eta_at, progress_25_sent_at, progress_50_sent_at, progress_75_sent_at, bird"
    )
    .is("delivered_notified_at", null)
    .lte("sent_at", nowISO)
    .gt("eta_at", nowISO);

  if (inflightErr) {
    return NextResponse.json({ error: inflightErr.message }, { status: 500 });
  }

  let midflight_25 = 0;
  let midflight_50 = 0;
  let midflight_75 = 0;
  let midflight_skipped_no_email = 0;

  for (const letter of inFlight ?? []) {
    if (!letter.to_email) {
      midflight_skipped_no_email++;
      continue;
    }

    const pct = progressPct(letter.sent_at, letter.eta_at);
    const statusPath = `/l/${letter.public_token}`;
    const absoluteStatusUrl = joinUrl(baseUrl, statusPath);
    const etaUtcText = formatUtc(letter.eta_at);
    const bird = normalizeBird((letter as any).bird);

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
            statusUrl={absoluteStatusUrl}   // ✅ absolute URL
            etaTextUtc={etaUtcText}
            funLine={funLine}
            bird={bird}
          />
        ),
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
  });
}