import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { Resend } from "resend";

export async function GET(req: Request) {
  // Auth first (cheap)
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create Resend client at runtime (prevents build-time crash)
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Missing RESEND_API_KEY in environment variables" },
      { status: 500 }
    );
  }
  const resend = new Resend(key);

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const mailFrom = process.env.MAIL_FROM;

  if (!mailFrom) {
    return NextResponse.json(
      { error: "Missing MAIL_FROM in environment variables" },
      { status: 500 }
    );
  }

  // Find letters ready for delivery
  const { data: letters, error } = await supabaseServer
    .from("letters")
    .select("id, to_email, from_name, subject, public_token, eta_at")
    .is("delivered_notified_at", null)
    .not("to_email", "is", null)
    .lte("eta_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;

  for (const letter of letters ?? []) {
    if (!letter.to_email) continue;

    const url = `${base}/l/${letter.public_token}`;

    await resend.emails.send({
      from: mailFrom,
      to: letter.to_email,
      subject: letter.subject || "🕊️ Your letter has arrived",
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
          <p>Your letter from <strong>${letter.from_name || "Someone"}</strong> has arrived.</p>
          <p><a href="${url}">Open your letter</a></p>
        </div>
      `,
    });

    await supabaseServer
      .from("letters")
      .update({ delivered_notified_at: new Date().toISOString() })
      .eq("id", letter.id);

    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}