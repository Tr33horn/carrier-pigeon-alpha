import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "../../../lib/supabaseServer";
import { Resend } from "resend";

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

  const {
    from_name,
    from_email, // ✅ sender email from client
    to_name,
    to_email,
    subject,
    message,
    origin,
    destination,
  } = body;

  const SPEED_KMH = 72;
  const REST_FACTOR = 1.15;

  const km = distanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const hours = (km / SPEED_KMH) * REST_FACTOR;
  const ms = Math.round(hours * 60 * 60 * 1000);

  const sentAt = new Date();
  const etaAt = new Date(sentAt.getTime() + ms);
  const publicToken = crypto.randomBytes(16).toString("hex");

  // ✅ existing recipient normalize
  const normalizedEmail =
    typeof to_email === "string" && to_email.trim().length > 0
      ? to_email.trim()
      : null;

  // ✅ B) NEW: normalize sender email
  const normalizedFromEmail =
    typeof from_email === "string" && from_email.trim().length > 0
      ? from_email.trim()
      : null;

  const { data: letter, error: letterErr } = await supabaseServer
    .from("letters")
    .insert({
      public_token: publicToken,
      from_name,
      from_email: normalizedFromEmail, // ✅ C) NEW: store sender email
      sender_receipt_sent_at: null,     // ✅ C) NEW: receipt flag (requires column)
      to_name,
      to_email: normalizedEmail,
      delivered_notified_at: null,
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

  // ✅ NEW: send "Pigeon launched" email immediately (if recipient email provided)
  if (normalizedEmail) {
    try {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("Missing RESEND_API_KEY");
      const resend = new Resend(key);

      const base = process.env.APP_BASE_URL || "http://localhost:3000";
      const statusUrl = `${base}/l/${publicToken}`;
      const etaText = new Date(letter.eta_at).toLocaleString();

      await resend.emails.send({
        from: process.env.MAIL_FROM || "Carrier Pigeon <no-reply@localhost>",
        to: normalizedEmail,
        subject: "🕊️ A sealed letter is on the way",
        html: `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.5">
            <h2 style="margin: 0 0 8px">A pigeon has departed.</h2>
            <p style="margin: 0 0 12px">
              You have a letter from <strong>${from_name || "Someone"}</strong>.
              It stays sealed until delivery.
            </p>
            <p style="margin: 0 0 12px"><strong>ETA:</strong> ${etaText}</p>
            <p style="margin: 0 0 16px">
              <a href="${statusUrl}" style="display:inline-block;padding:10px 14px;border-radius:10px;text-decoration:none;border:1px solid #222">
                Track flight status
              </a>
            </p>
            <p style="opacity: 0.7; margin: 0">
              (No peeking. The bird is watching.)
            </p>
          </div>
        `,
      });
    } catch (e) {
      // Don't fail the whole send if email fails — just log it.
      console.error("LAUNCH EMAIL ERROR:", e);
    }
  }

  return NextResponse.json({ public_token: publicToken, eta_at: letter.eta_at });
}