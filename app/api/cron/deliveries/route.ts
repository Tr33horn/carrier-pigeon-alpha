import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { Resend } from "resend";

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

/** Escape any user content so it can't inject HTML into email */
function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Preserve newlines in email */
function nl2br(input: string) {
  return input.replace(/\r\n|\r|\n/g, "<br/>");
}

export async function GET(req: Request) {
  // Auth first
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  }
  const resend = new Resend(key);

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const mailFrom = process.env.MAIL_FROM || "Carrier Pigeon <no-reply@localhost>";

  /* --------------------------
     A) DELIVERIES
  -------------------------- */

  const { data: lettersToDeliver, error: deliverErr } = await supabaseServer
    .from("letters")
    .select(
      // ✅ added body so the recipient email can include the message
      "id, public_token, eta_at, subject, body, from_name, from_email, to_name, to_email, delivered_notified_at, sender_receipt_sent_at"
    )
    .is("delivered_notified_at", null)
    .lte("eta_at", new Date().toISOString());

  if (deliverErr) {
    return NextResponse.json({ error: deliverErr.message }, { status: 500 });
  }

  let delivered_recipient_emails = 0;
  let delivered_sender_receipts = 0;

  for (const letter of lettersToDeliver ?? []) {
    const url = `${base}/l/${letter.public_token}`;

    const safeSubject = escapeHtml((letter.subject || "(No subject)").trim() || "(No subject)");
    const safeBody = escapeHtml((letter.body || "").trim());
    const safeBodyWithBreaks = nl2br(safeBody);

    // Recipient delivery email
    if (letter.to_email) {
      await resend.emails.send({
        from: mailFrom,
        to: letter.to_email,
        subject: letter.subject || "🕊️ Your letter has arrived",
        html: `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
            <h2 style="margin:0 0 8px">The pigeon has landed.</h2>
            <p style="margin:0 0 12px">
              Your sealed letter from <strong>${escapeHtml(letter.from_name || "Someone")}</strong> is ready.
            </p>

            <!-- ✅ Subject + message included -->
            <div style="margin:14px 0 14px; padding:12px; border:1px solid #e5e5e5; border-radius:12px; background:#fafafa;">
              <div style="font-weight:800; margin:0 0 8px;">Subject</div>
              <div style="margin:0 0 12px;">${safeSubject}</div>

              <div style="font-weight:800; margin:0 0 8px;">Message</div>
              <div style="white-space: normal; margin:0;">
                ${safeBodyWithBreaks || "<em>(No message)</em>"}
              </div>
            </div>

            <p style="margin:0 0 16px">
              <a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
                Open on the flight log
              </a>
            </p>

            <p style="opacity:.7;margin:0">No further pecking required.</p>
          </div>
        `,
      });
      delivered_recipient_emails++;
    }

    // Mark delivered notification done (even if no to_email)
    await supabaseServer
      .from("letters")
      .update({ delivered_notified_at: new Date().toISOString() })
      .eq("id", letter.id);

    // Sender receipt (if present + not already sent)
    if (letter.from_email && !letter.sender_receipt_sent_at) {
      await resend.emails.send({
        from: mailFrom,
        to: letter.from_email,
        subject: "✅ Delivery receipt: your pigeon landed",
        html: `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
            <h2 style="margin:0 0 8px">Delivery confirmed.</h2>
            <p style="margin:0 0 12px">
              Your letter to <strong>${escapeHtml(letter.to_name || "the recipient")}</strong> has been delivered.
            </p>
            <p style="margin:0 0 16px">
              <a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
                View flight status
              </a>
            </p>
            <p style="opacity:.7;margin:0">The bird has been compensated in snacks.</p>
          </div>
        `,
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
     - Only for letters NOT delivered yet
     - Only if recipient email exists
  -------------------------- */

  const nowISO = new Date().toISOString();

  const { data: inFlight, error: inflightErr } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, subject, from_name, to_email, sent_at, eta_at, progress_25_sent_at, progress_50_sent_at, progress_75_sent_at"
    )
    .is("delivered_notified_at", null) // not delivered yet
    .lte("sent_at", nowISO)            // already sent
    .gt("eta_at", nowISO);             // eta still in the future

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
    const url = `${base}/l/${letter.public_token}`;

    const sendUpdate = async (
      milestone: 25 | 50 | 75,
      column: "progress_25_sent_at" | "progress_50_sent_at" | "progress_75_sent_at"
    ) => {
      const subjectLine =
        milestone === 25
          ? "🕊️ Update: 25% of the way there"
          : milestone === 50
          ? "🕊️ Update: Halfway to you"
          : "🕊️ Update: 75% complete (incoming!)";

      const funLine =
        milestone === 25
          ? "The pigeon has left the parking lot."
          : milestone === 50
          ? "Mid-flight snack negotiations successful."
          : "You may now hear faint wing sounds in the distance.";

      await resend.emails.send({
        from: mailFrom,
        to: letter.to_email!,
        subject: subjectLine,
        html: `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
            <h2 style="margin:0 0 8px">${milestone}% progress</h2>
            <p style="margin:0 0 12px">
              Your sealed letter from <strong>${escapeHtml(letter.from_name || "Someone")}</strong> is still in flight.
            </p>
            <p style="margin:0 0 12px"><em>${escapeHtml(funLine)}</em></p>
            <p style="margin:0 0 16px">
              <a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
                Check flight status (${pct}%)
              </a>
            </p>
            <p style="opacity:.7;margin:0">Still sealed. Still mysterious.</p>
          </div>
        `,
      });

      await supabaseServer
        .from("letters")
        .update({ [column]: new Date().toISOString() })
        .eq("id", letter.id);
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
    ran_at: new Date().toISOString(),

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