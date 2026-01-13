import { NextResponse } from "next/server";
import { createElement } from "react";
import { supabaseServer } from "../../../lib/supabaseServer";
import { sendEmail } from "../../../lib/email/send";
import { LetterStatusLinkResentEmail } from "@/emails/LetterStatusLinkResent";

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

  const base = process.env.APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";

  const { data: letter, error } = await supabaseServer
    .from("letters")
    .select("public_token, from_email, subject, origin_name, dest_name")
    .eq("public_token", public_token)
    .maybeSingle();

  if (error || !letter) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  if ((letter.from_email || "").trim().toLowerCase() !== from_email) {
    return NextResponse.json({ error: "Sender email does not match this letter" }, { status: 403 });
  }

  const url = `${base}/l/${letter.public_token}`;

  await sendEmail({
    to: from_email,
    subject: "Your status link (re-sent)",
    react: createElement(LetterStatusLinkResentEmail as any, {
      subject: letter.subject || "(No subject)",
      originName: letter.origin_name || "",
      destName: letter.dest_name || "",
      statusUrl: url,
    }),
  });

  return NextResponse.json({ ok: true });
}