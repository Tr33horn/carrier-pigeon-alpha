import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { Resend } from "resend";

export async function GET(req: Request) {
  // Auth first
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing RESEND_API_KEY" },
      { status: 500 }
    );
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

  let sent = 0;
  let receipts = 0;

  for (const letter of letters ?? []) {
    const url = `${base}/l/${letter.public_token}`;

    // 1) Recipient delivery email (only if recipient email exists)
    if (letter.to_email) {
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
              <a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
                Open your letter
              </a>
            </p>
            <p style="opacity:.7;margin:0">No further pecking required.</p>
          </div>
        `,
      });

      sent++;
    }

    // Mark recipient notification as done (even if no to_email, to stop reprocessing forever)
    await supabaseServer
      .from("letters")
      .update({ delivered_notified_at: new Date().toISOString() })
      .eq("id", letter.id);

    // 2) Sender receipt email (only if sender email exists AND not already sent)
    if (letter.from_email && !letter.sender_receipt_sent_at) {
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

      receipts++;
    }
  }

  return NextResponse.json({ ok: true, sent, receipts, processed: (letters ?? []).length });
}