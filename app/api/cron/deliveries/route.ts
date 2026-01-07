import { NextResponse } from "next/server";
import React from "react";
import { supabaseServer } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email/send";

import { LetterDeliveredEmail } from "@/emails/LetterDelivered";
import { LetterProgressUpdateEmail } from "@/emails/LetterProgressUpdate";

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

export async function GET(req: Request) {
  // --- auth ---
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowISO = new Date().toISOString();

  /* --------------------------
     A) DELIVERIES
  -------------------------- */

  const { data: lettersToDeliver, error: deliverErr } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, eta_at, from_name, from_email, to_name, to_email, delivered_notified_at, sender_receipt_sent_at, origin_name, dest_name, subject"
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

    // Recipient delivered email
    if (letter.to_email) {
      await sendEmail({
        to: letter.to_email,
        subject: letter.subject?.trim() ? `Delivered: ${letter.subject.trim()}` : "Your letter has arrived",
        react: React.createElement(LetterDeliveredEmail, {
          toName: letter.to_name,
          fromName: letter.from_name,
          statusUrl: statusPath, // template will join with APP_URL
          originName: letter.origin_name || "Origin",
          destName: letter.dest_name || "Destination",
        }),
      });

      delivered_recipient_emails++;
    }

    // Always mark delivered_notified_at (even if no to_email)
    await supabaseServer
      .from("letters")
      .update({ delivered_notified_at: new Date().toISOString() })
      .eq("id", letter.id);

    // Sender receipt (optional, still inline)
    if (letter.from_email && !letter.sender_receipt_sent_at) {
      const deliveredAtUtc = formatUtc(new Date().toISOString());

      await sendEmail({
        to: letter.from_email,
        subject: "Delivery receipt: confirmed",
        react: React.createElement(
          "div",
          { style: { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", lineHeight: 1.5 } },
          React.createElement("h2", { style: { margin: "0 0 8px" } }, "Delivery confirmed ✅"),
          React.createElement(
            "p",
            { style: { margin: "0 0 12px" } },
            "Your letter to ",
            React.createElement("strong", null, letter.to_name || "the recipient"),
            " has been delivered."
          ),
          React.createElement(
            "p",
            { style: { margin: "0 0 12px", opacity: 0.75 } },
            React.createElement("strong", null, "Delivered:"),
            " ",
            deliveredAtUtc
          ),
          React.createElement(
            "p",
            { style: { margin: "0 0 16px" } },
            React.createElement(
              "a",
              {
                href: statusPath,
                style: {
                  display: "inline-block",
                  padding: "10px 14px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid #222",
                },
              },
              "View flight status"
            )
          ),
          React.createElement("p", { style: { opacity: 0.7, margin: 0 } }, "The bird has been compensated in snacks.")
        ),
      });

      await supabaseServer
        .from("letters")
        .update({ sender_receipt_sent_at: new Date().toISOString() })
        .eq("id", letter.id);

      delivered_sender_receipts++;
    }
  }

  /* --------------------------
     B) MID-FLIGHT UPDATES (25/50/75)
     - only not delivered
     - only if recipient has email
  -------------------------- */

  const { data: inFlight, error: inflightErr } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, subject, from_name, to_email, sent_at, eta_at, progress_25_sent_at, progress_50_sent_at, progress_75_sent_at"
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
        react: React.createElement(LetterProgressUpdateEmail, {
          milestone,
          pct,
          fromName: letter.from_name,
          statusUrl: statusPath,
          etaTextUtc: etaUtcText,
          funLine,
        }),
      });

      await supabaseServer.from("letters").update({ [column]: new Date().toISOString() }).eq("id", letter.id);
    };

    // milestone logic (highest first)
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