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
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Pull the most recent letters sent by this sender email
  const { data, error } = await supabaseServer
    .from("letters")
    .select(
      `
      id,
      public_token,
      from_name,
      from_email,
      to_name,
      to_email,
      subject,
      origin_name,
      origin_lat,
      origin_lon,
      dest_name,
      dest_lat,
      dest_lon,
      sent_at,
      eta_at,
      delivered_notified_at,
      sender_receipt_sent_at,
      distance_km,
      speed_kmh
    `
    )
    .eq("from_email", email)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();

  let letters = (data ?? []).map((l: any) => {
    const sent = Date.parse(l.sent_at);
    const eta = Date.parse(l.eta_at);

    const delivered = Number.isFinite(eta) ? now >= eta : true;

    const progress =
      Number.isFinite(sent) && Number.isFinite(eta) && eta > sent
        ? Math.max(0, Math.min(1, (now - sent) / (eta - sent)))
        : 1;

    // current position for mini map + UI (linear interp)
    const curLat =
      Number.isFinite(l.origin_lat) && Number.isFinite(l.dest_lat)
        ? l.origin_lat + (l.dest_lat - l.origin_lat) * progress
        : null;

    const curLon =
      Number.isFinite(l.origin_lon) && Number.isFinite(l.dest_lon)
        ? l.origin_lon + (l.dest_lon - l.origin_lon) * progress
        : null;

    return {
      ...l,
      delivered,
      progress,
      current_lat: curLat,
      current_lon: curLon,

      // consistent display fields for UI/email parity
      sent_utc_text: l.sent_at ? `${formatUTC(l.sent_at)} UTC` : "",
      eta_utc_text: l.eta_at ? `${formatUTC(l.eta_at)} UTC` : "",
      eta_utc_iso: l.eta_at || null,

      // default until we merge counts
      badges_count: 0,
    };
  });

  // Optional server-side search filtering (still returns <= 50 base list)
  if (q) {
    letters = letters.filter((l: any) => {
      const hay = [
        l.subject,
        l.to_name,
        l.to_email,
        l.origin_name,
        l.dest_name,
        l.public_token,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  // ✅ Badge counts (cheap, no badge payload)
  // Only do this if we have letters to look up.
  const letterIds = letters.map((l: any) => l.id).filter(Boolean);
  if (letterIds.length) {
    const { data: badgeRows, error: badgeErr } = await supabaseServer
      .from("letter_items")
      .select("letter_id")
      .in("letter_id", letterIds)
      .eq("kind", "badge");

    if (!badgeErr && badgeRows?.length) {
      const counts = new Map<string, number>();
      for (const r of badgeRows as any[]) {
        counts.set(r.letter_id, (counts.get(r.letter_id) ?? 0) + 1);
      }
      letters = letters.map((l: any) => ({
        ...l,
        badges_count: counts.get(l.id) ?? 0,
      }));
    }
    // If badgeErr happens, we just leave badges_count = 0 and still return letters.
  }

  return NextResponse.json({ letters });
}