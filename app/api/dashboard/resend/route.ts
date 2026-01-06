import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { Resend } from "resend";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const from_email = String(body?.from_email || "").trim().toLowerCase();
  const public_token = String(body?.public_token || "").trim();

  if (!public_token) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }
  if (!from_email || !isValidEmail(from_email)) {
    return NextResponse.json({ error: "Valid from_email required" }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const mailFrom = process.env.MAIL_FROM || "FLOK <onboarding@resend.dev>";

  // Verify the sender matches the letter
  const { data: letter, error } = await supabaseServer
    .from("letters")
    .select("id, public_token, from_email, to_name, subject, origin_name, dest_name, sent_at, eta_at")
    .eq("public_token", public_token)
    .maybeSingle();

  if (error || !letter) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  if ((letter.from_email || "").trim().toLowerCase() !== from_email) {
    return NextResponse.json({ error: "Sender email does not match this letter" }, { status: 403 });
  }

  const resend = new Resend(key);
  const url = `${base}/l/${letter.public_token}`;

  await resend.emails.send({
    from: mailFrom,
    to: from_email,
    subject: "🕊️ Your status link (re-sent)",
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
        <h2 style="margin:0 0 8px">Status link re-sent</h2>
        <p style="margin:0 0 10px">
          <strong>${(letter.subject || "(No subject)").replace(/</g, "&lt;")}</strong>
        </p>
        <p style="margin:0 0 14px; opacity:.85">
          ${String(letter.origin_name || "").replace(/</g, "&lt;")} → ${String(letter.dest_name || "").replace(/</g, "&lt;")}
        </p>
        <p style="margin:0 0 16px">
          <a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
            View flight status
          </a>
        </p>
        <p style="opacity:.7;margin:0">The pigeon swears this is the last time.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}