import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatUTC(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Pull the most recent letters sent by this sender email
  const { data, error } = await supabaseServer
    .from("letters")
    .select(
      "id, public_token, from_name, from_email, to_name, to_email, subject, origin_name, dest_name, sent_at, eta_at, delivered_notified_at, sender_receipt_sent_at, distance_km, speed_kmh"
    )
    .eq("from_email", email)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Server-side computed status to keep UI simple
  const now = Date.now();
  const letters = (data ?? []).map((l: any) => {
    const sent = Date.parse(l.sent_at);
    const eta = Date.parse(l.eta_at);

    const delivered = Number.isFinite(eta) ? now >= eta : true;

    const progress =
      Number.isFinite(sent) && Number.isFinite(eta) && eta > sent
        ? Math.max(0, Math.min(1, (now - sent) / (eta - sent)))
        : 1;

    return {
      ...l,
      delivered,
      progress,

      // ✅ NEW: consistent display fields for UI/email parity
      sent_utc_text: l.sent_at ? `${formatUTC(l.sent_at)} UTC` : "",
      eta_utc_text: l.eta_at ? `${formatUTC(l.eta_at)} UTC` : "",
      eta_utc_iso: l.eta_at || null,
    };
  });

  return NextResponse.json({ letters });
}