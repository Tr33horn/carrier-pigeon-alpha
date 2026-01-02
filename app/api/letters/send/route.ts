import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "../../../lib/supabaseServer";

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(x));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function generateCheckpoints(
  sentAt: Date,
  etaAt: Date,
  oLat: number,
  oLon: number,
  dLat: number,
  dLon: number
) {
  const count = 8;
  const totalMs = etaAt.getTime() - sentAt.getTime();
  const labels = [
    "Departed roost",
    "Cruising altitude",
    "Tailwind acquired",
    "Crossing the plains",
    "Snack break (imaginary)",
    "Over the mountains",
    "Approaching destination",
    "Final descent",
  ];

  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return {
      idx: i,
      name: labels[i] ?? `Checkpoint ${i + 1}`,
      lat: lerp(oLat, dLat, t),
      lon: lerp(oLon, dLon, t),
      at: new Date(sentAt.getTime() + totalMs * t).toISOString(),
    };
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  // ✅ NEW: accept to_email from client
  const { from_name, to_name, to_email, subject, message, origin, destination } = body;

  const SPEED_KMH = 72; // ~45 mph
  const REST_FACTOR = 1.15; // “pigeon reality tax”

  const km = distanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const hours = (km / SPEED_KMH) * REST_FACTOR;
  const ms = Math.round(hours * 60 * 60 * 1000);

  const sentAt = new Date();
  const etaAt = new Date(sentAt.getTime() + ms);
  const publicToken = crypto.randomBytes(16).toString("hex");

  const normalizedEmail =
    typeof to_email === "string" && to_email.trim().length > 0
      ? to_email.trim()
      : null;

  const { data: letter, error: letterErr } = await supabaseServer
    .from("letters")
    .insert({
      public_token: publicToken,
      from_name,
      to_name,
      to_email: normalizedEmail, // ✅ NEW
      delivered_notified_at: null, // ✅ NEW (optional but explicit)
      subject,
      body: message,
      origin_name: origin.name,
      origin_lat: origin.lat,
      origin_lon: origin.lon,
      dest_name: destination.name,
      dest_lat: destination.lat,
      dest_lon: destination.lon,
      distance_km: km,
      speed_kmh: SPEED_KMH,
      sent_at: sentAt.toISOString(),
      eta_at: etaAt.toISOString(),
    })
    .select("id, public_token, eta_at")
    .single();

  if (letterErr || !letter) {
    return NextResponse.json(
      { error: letterErr?.message ?? "Insert failed" },
      { status: 500 }
    );
  }

  const checkpoints = generateCheckpoints(
    sentAt,
    etaAt,
    origin.lat,
    origin.lon,
    destination.lat,
    destination.lon
  );

  const { error: cpErr } = await supabaseServer.from("letter_checkpoints").insert(
    checkpoints.map((cp) => ({
      letter_id: letter.id,
      idx: cp.idx,
      name: cp.name,
      lat: cp.lat,
      lon: cp.lon,
      at: cp.at,
    }))
  );

  if (cpErr) {
    return NextResponse.json({ error: cpErr.message }, { status: 500 });
  }

  return NextResponse.json({ public_token: publicToken, eta_at: letter.eta_at });
}