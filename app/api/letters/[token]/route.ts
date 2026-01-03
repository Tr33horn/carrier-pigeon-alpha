import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

function formatUtc(iso: string) {
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
    timeZoneName: "short",
  }).format(d);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;

  // First fetch: metadata ONLY (no body)
  const { data: meta, error: metaErr } = await supabaseServer
    .from("letters")
    .select(
      `
      id,
      public_token,
      from_name,
      to_name,
      subject,
      origin_name,
      origin_lat,
      origin_lon,
      dest_name,
      dest_lat,
      dest_lon,
      distance_km,
      speed_kmh,
      sent_at,
      eta_at
    `
    )
    .eq("public_token", token)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (metaErr || !meta) {
    return NextResponse.json(
      { error: metaErr?.message ?? "Not found" },
      { status: 404 }
    );
  }

  // Fetch checkpoints
  const { data: checkpoints, error: cErr } = await supabaseServer
    .from("letter_checkpoints")
    .select("id, idx, name, at, lat, lon")
    .eq("letter_id", meta.id)
    .order("idx", { ascending: true });

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  // Decide delivery server-side
  const now = Date.now();
  const eta = Date.parse(meta.eta_at);
  const delivered = Number.isFinite(eta) ? now >= eta : true;

  // Only fetch body AFTER delivery
  let body: string | null = null;

  if (delivered) {
    const { data: bodyRow } = await supabaseServer
      .from("letters")
      .select("body")
      .eq("id", meta.id)
      .single();

    body = bodyRow?.body ?? null;
  }

  return NextResponse.json({
    letter: {
      ...meta,
      body,
      // ✅ add this so the UI can display the same UTC string consistently
      eta_utc_text: formatUtc(meta.eta_at),
    },
    checkpoints: checkpoints ?? [],
    delivered,
  });
}