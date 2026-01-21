import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });

export async function POST() {
  try {
    const authClient = await createSupabaseServerReadClient();
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user ?? null;
    if (!user) return json({ error: "auth required" }, 401);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) return json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, 500);
    if (!serviceKey) return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const token = crypto.randomBytes(16).toString("hex");
    const token_hash = crypto.createHash("sha256").update(token).digest("hex");

    const now = Date.now();
    const eta_at = new Date(now + 30 * 60 * 1000).toISOString();
    const expires_at = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

    const origin_lat = 47.5287;
    const origin_lon = -121.8254;
    const dest_lat = 47.5301;
    const dest_lon = -121.825;
    const distance_km = haversineKm(origin_lat, origin_lon, dest_lat, dest_lon);
    const speed_kmh = 40;

    const { data: letter, error: letterErr } = await supabase
      .from("letters")
      .insert({
        to_name: "Dev Recipient",
        from_name: "Dev Sender",
        subject: "Dev Seed Letter",
        body: "Hello from dev seed",
        message: "Hello from dev seed",
        sender_user_id: user.id,
        bird: "stork",
        bird_type: "stork",
        origin_name: "Snoqualmie, WA",
        origin_lat,
        origin_lon,
        dest_name: "snoqualmie-pass",
        dest_region_id: "snoqualmie-pass",
        dest_lat,
        dest_lon,
        eta_at,
        from_email: "dev@local.test",
        to_email: "dev-recipient@local.test",
        public_token: token,
        distance_km,
        speed_kmh,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (letterErr) return json({ error: "letters insert failed", details: letterErr }, 500);

    const { error: tokErr } = await supabase
      .from("letter_open_tokens")
      .insert({
        letter_id: letter.id,
        token_hash,
        expires_at,
      });

    if (tokErr) return json({ error: "letter_open_tokens insert failed", details: tokErr }, 500);

    return json({ token, url: `/l/${token}`, letter_id: letter.id });
  } catch (e: any) {
    return json({ error: "Unhandled exception", message: e?.message ?? String(e), stack: e?.stack }, 500);
  }
}

export async function GET(_req: Request) {
  return POST();
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
