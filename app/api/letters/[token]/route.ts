import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

// ✅ geo helpers
import { checkpointGeoText, geoRegionForPoint } from "../../../lib/geo";

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

type LetterItemInsert = {
  letter_id: string;
  kind: "badge" | "addon";
  code: string;
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  rarity?: "common" | "rare" | "legendary";
  earned_at?: string; // ISO string
  meta?: any;
};

type BadgeDef = {
  code: string;
  title: string;
  subtitle?: string;
  icon?: string;
  rarity?: "common" | "rare" | "legendary";
  meta?: any;
  earned_at?: string;
};

/** Turn a region sequence into "crossed_*" badges (idempotent + extendable) */
function computeBadgesFromRegions(args: {
  origin?: { name?: string; regionId?: string | null };
  dest?: { name?: string; regionId?: string | null };
  pastRegionIds: string[]; // in order
  delivered?: boolean;
  deliveredAtISO?: string;
}) {
  const { pastRegionIds, delivered, deliveredAtISO } = args;

  // Reduce to change-points only: [a,a,a,b,b,c] => [a,b,c]
  const seq: string[] = [];
  for (const r of pastRegionIds) {
    if (!r) continue;
    if (seq.length === 0 || seq[seq.length - 1] !== r) seq.push(r);
  }

  const has = (id: string) => seq.includes(id);

  // "Crossed X" style: award once they've been in region AND later left it
  const crossed = (regionId: string) => {
    const i = seq.indexOf(regionId);
    return i !== -1 && i < seq.length - 1;
  };

  const out: BadgeDef[] = [];

  // ✅ NOTE: These region IDs MUST match your US_REGIONS ids.
  // Your current US_REGIONS uses: "cascades-n", "rockies-n", "great-plains", etc.

  if (crossed("cascades-n")) {
    out.push({
      code: "crossed_cascades",
      title: "Crossed the Cascades",
      subtitle: "Mountains approved. Wings questionable.",
      icon: "🏔️",
      rarity: "common",
      meta: { region: "cascades-n" },
    });
  }

  if (crossed("rockies-n")) {
    out.push({
      code: "crossed_rockies",
      title: "Crossed the Rockies",
      subtitle: "Altitude gained. Ego remained modest.",
      icon: "⛰️",
      rarity: "rare",
      meta: { region: "rockies-n" },
    });
  }

  if (crossed("great-plains")) {
    out.push({
      code: "across_the_plains",
      title: "Across the Great Plains",
      subtitle: "So flat you can hear tomorrow.",
      icon: "🌾",
      rarity: "common",
      meta: { region: "great-plains" },
    });
  }

  // ✅ Appalachians exists in your US_REGIONS as "appalachians"
  if (crossed("appalachians")) {
    out.push({
      code: "crossed_appalachians",
      title: "Crossed the Appalachians",
      subtitle: "Old hills, new bragging rights.",
      icon: "⛰️",
      rarity: "rare",
      meta: { region: "appalachians" },
    });
  }

  // ✅ Optional: “presence” style badges (only if region exists)
  // Example: Snake River Plain exists as "snake-river"
  if (has("snake-river")) {
    out.push({
      code: "over_snake_river_plain",
      title: "Over the Snake River Plain",
      subtitle: "Wide open, tailwind energy.",
      icon: "🌀",
      rarity: "common",
      meta: { region: "snake-river" },
    });
  }

  // ❌ Removed for now (not in your US_REGIONS yet):
  // - mississippi
  // - southwest_desert (you have mojave + sonoran instead)

  // ✅ Delivered badge (only when delivered)
  if (delivered) {
    out.push({
      code: "delivered",
      title: "Delivered",
      subtitle: "Wax seal retired with honor.",
      icon: "📬",
      rarity: "common",
      meta: { delivered: true },
      earned_at: deliveredAtISO,
    });
  }

  // Dedup by code just in case
  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.code) ? false : (seen.add(b.code), true)));
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
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
    return NextResponse.json({ error: metaErr?.message ?? "Not found" }, { status: 404 });
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
  const nowMs = Date.now();
  const etaMs = Date.parse(meta.eta_at);
  const delivered = Number.isFinite(etaMs) ? nowMs >= etaMs : true;

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

  // ✅ Upgrade checkpoint labels + add geo_text + region_id
  const cps = (checkpoints ?? []).map((cp: any, i: number, arr: any[]) => {
    const isFirst = i === 0;
    const isLast = i === arr.length - 1;

    const geo =
      Number.isFinite(cp.lat) && Number.isFinite(cp.lon)
        ? checkpointGeoText(cp.lat, cp.lon)
        : "somewhere over the U.S.";

    const region =
      Number.isFinite(cp.lat) && Number.isFinite(cp.lon)
        ? geoRegionForPoint(cp.lat, cp.lon) // { id, label } or null
        : null;

    const upgradedName = isFirst
      ? `Departed roost — ${geo}`
      : isLast
      ? `Final descent — ${geo}`
      : geo;

    return {
      ...cp,
      geo_text: geo,
      region_id: region?.id ?? null,
      region_label: region?.label ?? null,
      name: upgradedName,
    };
  });

  // ✅ compute current_over_text (geo only) for map/tooltips
  let current_over_text = delivered ? "Delivered" : "somewhere over the U.S.";
  if (!delivered && cps.length) {
    let cur = cps[0];
    for (const cp of cps) {
      const t = Date.parse(cp.at);
      if (Number.isFinite(t) && t <= nowMs) cur = cp;
      else break;
    }
    current_over_text = cur?.geo_text || current_over_text;
  }

  // ✅ Award badges (based on past checkpoints only)
  const past = cps.filter((cp: any) => {
    const t = Date.parse(cp.at);
    return Number.isFinite(t) && t <= nowMs;
  });

  const pastRegionIds = past.map((cp: any) => cp.region_id).filter(Boolean) as string[];

  const originRegion =
    Number.isFinite(meta.origin_lat) && Number.isFinite(meta.origin_lon)
      ? geoRegionForPoint(meta.origin_lat, meta.origin_lon)
      : null;

  const destRegion =
    Number.isFinite(meta.dest_lat) && Number.isFinite(meta.dest_lon)
      ? geoRegionForPoint(meta.dest_lat, meta.dest_lon)
      : null;

  const computedBadges = computeBadgesFromRegions({
    origin: { name: meta.origin_name, regionId: originRegion?.id ?? null },
    dest: { name: meta.dest_name, regionId: destRegion?.id ?? null },
    pastRegionIds,
    delivered,
    deliveredAtISO: delivered ? new Date(Math.max(nowMs, etaMs || nowMs)).toISOString() : undefined,
  });

  // ✅ Upsert badges (idempotent) — set earned_at so sorting works
  if (computedBadges.length) {
    const earnedAtDefault = new Date(nowMs).toISOString();

    const rows: LetterItemInsert[] = computedBadges.map((b) => ({
      letter_id: meta.id,
      kind: "badge",
      code: b.code,
      title: b.title,
      subtitle: b.subtitle ?? null,
      icon: b.icon ?? null,
      rarity: b.rarity ?? "common",
      earned_at: b.earned_at ?? earnedAtDefault,
      meta: b.meta ?? {},
    }));

    const { error: upsertErr } = await supabaseServer
      .from("letter_items")
      .upsert(rows, { onConflict: "letter_id,kind,code" });

    if (upsertErr) {
      console.error("BADGE UPSERT ERROR:", upsertErr);
    }
  }

  // ✅ Fetch items to return (badges + addons later)
  const { data: items, error: itemsErr } = await supabaseServer
    .from("letter_items")
    .select("id, kind, code, title, subtitle, icon, rarity, earned_at, meta")
    .eq("letter_id", meta.id)
    .order("earned_at", { ascending: true });

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  const badges = (items ?? []).filter((x: any) => x.kind === "badge");
  const addons = (items ?? []).filter((x: any) => x.kind === "addon");

  return NextResponse.json({
    letter: {
      ...meta,
      body,
      eta_utc_text: formatUtc(meta.eta_at),
    },
    checkpoints: cps,
    delivered,
    current_over_text,
    items: {
      badges,
      addons,
    },
  });
}