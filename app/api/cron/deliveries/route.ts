import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: Request) {
  // Simple auth so the world can’t spam this
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find letters ready for delivery
  const { data: letters, error } = await supabaseServer
    .from("letters")
    .select("id, to_email, from_name, subject, public_token")
    .is("delivered_notified_at", null)
    .not("to_email", "is", null)
    .lte("eta_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;

  for (const letter of letters ?? []) {
    if (!letter.to_email) continue;

    const url = `https://pigeon.humanrobotalliance/l/${letter.public_token}`;

    await resend.emails.send({
      from: "Carrier Pigeon <pigeon@pigeon.humanrobotalliance>",
      to: letter.to_email,
      subject: letter.subject || "🕊️ Your letter has arrived",
      html: `
        <p>Your letter from <strong>${letter.from_name || "Someone"}</strong> has arrived.</p>
        <p><a href="${url}">Open your letter</a></p>
      `,
    });

    // Mark as notified
    await supabaseServer
      .from("letters")
      .update({ delivered_notified_at: new Date().toISOString() })
      .eq("id", letter.id);

    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}