import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { Resend } from "resend";

export async function GET(req: Request) {
  // Auth first
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const urlObj = new URL(req.url);
  const dryRun = urlObj.searchParams.get("dryRun") === "1";

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  }
  const resend = new Resend(key);

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const mailFrom = process.env.MAIL_FROM || "Carrier Pigeon <no-reply@localhost>";

  // Letters ready to deliver AND not yet notified
  const { data: letters, error } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, eta_at, subject, from_name, from_email, to_name, to_email, delivered_notified_at, sender_receipt_sent_at"
    )
    .is("delivered_notified_at", null)
    .lte("eta_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const eligible = (letters ?? []).length;

  let recipient_emails_sent = 0;
  let sender_receipts_sent = 0;

  let skipped_no_to_email = 0;
  let skipped_no_from_email = 0;
  let skipped_receipt_already_sent = 0;

  // Track failures without killing the whole batch
  let recipient_email_errors = 0;
  let sender_receipt_errors = 0;
  let db_update_errors = 0;

  for (const letter of letters ?? []) {
    const statusUrl = `${base}/l/${letter.public_token}`;

    // 1) Recipient delivery email (only if recipient email exists)
    if (letter.to_email) {
      if (!dryRun) {
        try {
          await resend.emails.send({
            from: mailFrom,
            to: letter.to_email,
            subject: letter.subject || "🕊️ Your letter has arrived",
            html: `
              <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
                <h2 style="margin:0 0 8px">The pigeon has landed.</h2>
                <p style="margin:0 0 12px">
                  Your sealed letter from <strong>${letter.from_name || "Someone"}</strong> is ready.
                </p>
                <p style="margin:0 0 16px">
                  <a href="${statusUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
                    Open your letter
                  </a>
                </p>
                <p style="opacity:.7;margin:0">No further pecking required.</p>
              </div>
            `,
          });

          recipient_emails_sent++;
        } catch (e) {
          console.error("RECIPIENT EMAIL ERROR:", e);
          recipient_email_errors++;
        }
      } else {
        recipient_emails_sent++;
      }
    } else {
      skipped_no_to_email++;
    }

    // Mark recipient notification as done (even if no to_email, to stop reprocessing forever)
    if (!dryRun) {
      const { error: updErr } = await supabaseServer
        .from("letters")
        .update({ delivered_notified_at: new Date().toISOString() })
        .eq("id", letter.id);

      if (updErr) {
        console.error("DB UPDATE delivered_notified_at ERROR:", updErr);
        db_update_errors++;
      }
    }

    // 2) Sender receipt email (only if sender email exists AND not already sent)
    if (!letter.from_email) {
      skipped_no_from_email++;
      continue;
    }
    if (letter.sender_receipt_sent_at) {
      skipped_receipt_already_sent++;
      continue;
    }

    if (!dryRun) {
      try {
        await resend.emails.send({
          from: mailFrom,
          to: letter.from_email,
          subject: "✅ Delivery receipt: your pigeon landed",
          html: `
            <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
              <h2 style="margin:0 0 8px">Delivery confirmed.</h2>
              <p style="margin:0 0 12px">
                Your letter to <strong>${letter.to_name || "the recipient"}</strong> has been delivered.
              </p>
              <p style="margin:0 0 16px">
                <a href="${statusUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
                  View flight status
                </a>
              </p>
              <p style="opacity:.7;margin:0">The bird has been compensated in snacks.</p>
            </div>
          `,
        });

        const { error: updErr2 } = await supabaseServer
          .from("letters")
          .update({ sender_receipt_sent_at: new Date().toISOString() })
          .eq("id", letter.id);

        if (updErr2) {
          console.error("DB UPDATE sender_receipt_sent_at ERROR:", updErr2);
          db_update_errors++;
        } else {
          sender_receipts_sent++;
        }
      } catch (e) {
        console.error("SENDER RECEIPT EMAIL ERROR:", e);
        sender_receipt_errors++;
      }
    } else {
      sender_receipts_sent++;
    }
  }

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    dryRun,

    eligible,
    recipient_emails_sent,
    sender_receipts_sent,

    skipped_no_to_email,
    skipped_no_from_email,
    skipped_receipt_already_sent,

    recipient_email_errors,
    sender_receipt_errors,
    db_update_errors,
  });
}