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
  earned_at?: string; // optional
  meta?: any;
};

/** Turn a region sequence into "crossed_*" badges (idempotent + extendable) */
function computeBadgesFromRegions(args: {
  origin?: { name?: string; regionId?: string | null };
  dest?: { name?: string; regionId?: string | null };
  pastRegionIds: string[]; // in order
}) {
  const { pastRegionIds } = args;

  // Reduce to change-points only: [a,a,a,b,b,c] => [a,b,c]
  const seq: string[] = [];
  for (const r of pastRegionIds) {
    if (!r) continue;
    if (seq.length === 0 || seq[seq.length - 1] !== r) seq.push(r);
  }

  const has = (id: string) => seq.includes(id);

  const out: { code: string; title: string; subtitle?: string; icon?: string; rarity?: "common" | "rare" | "legendary"; meta?: any }[] = [];

  // --- "Crossed X" style badges (award once they've been in region AND later left it) ---
  // helper: region appears at i and later the sequence differs
  const crossed = (regionId: string) => {
    const i = seq.indexOf(regionId);
    return i !== -1 && i < seq.length - 1; // was in it, later left it
  };

  if (crossed("cascades")) {
    out.push({
      code: "crossed_cascades",
      title: "Crossed the Cascades",
      subtitle: "Mountains approved. Wings questionable.",
      icon: "🏔️",
      rarity: "common",
      meta: { region: "cascades" },
    });
  }

  if (crossed("rockies")) {
    out.push({
      code: "crossed_rockies",
      title: "Crossed the Rockies",
      subtitle: "Altitude gained. Ego remained modest.",
      icon: "⛰️",
      rarity: "rare",
      meta: { region: "rockies" },
    });
  }

  if (crossed("great_plains")) {
    out.push({
      code: "across_the_plains",
      title: "Across the Great Plains",
      subtitle: "So flat you can hear tomorrow.",
      icon: "🌾",
      rarity: "common",
      meta: { region: "great_plains" },
    });
  }

  if (crossed("mississippi")) {
    out.push({
      code: "crossed_mississippi",
      title: "Crossed the Mississippi",
      subtitle: "Big river energy.",
      icon: "🌊",
      rarity: "rare",
      meta: { region: "mississippi" },
    });
  }

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

  // --- Fun “destination reached” style badge (only when delivered) ---
  // You can award this elsewhere too; included here for future use.

  // --- Region presence badges (optional; enable if you want more “collectibles”) ---
  if (has("southwest_desert")) {
    out.push({
      code: "over_the_desert",
      title: "Over the Desert",
      subtitle: "Hydration status: imaginary.",
      icon: "🌵",
      rarity: "common",
      meta: { region: "southwest_desert" },
    });
  }

  // Dedup by code just in case
  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.code) ? false : (seen.add(b.code), true)));
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

    const region = Number.isFinite(cp.lat) && Number.isFinite(cp.lon)
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

  const originRegion = Number.isFinite(meta.origin_lat) && Number.isFinite(meta.origin_lon)
    ? geoRegionForPoint(meta.origin_lat, meta.origin_lon)
    : null;

  const destRegion = Number.isFinite(meta.dest_lat) && Number.isFinite(meta.dest_lon)
    ? geoRegionForPoint(meta.dest_lat, meta.dest_lon)
    : null;

  const computedBadges = computeBadgesFromRegions({
    origin: { name: meta.origin_name, regionId: originRegion?.id ?? null },
    dest: { name: meta.dest_name, regionId: destRegion?.id ?? null },
    pastRegionIds,
  });

  // ✅ Upsert badges (idempotent)
  if (computedBadges.length) {
    const rows: LetterItemInsert[] = computedBadges.map((b) => ({
      letter_id: meta.id,
      kind: "badge",
      code: b.code,
      title: b.title,
      subtitle: b.subtitle ?? null,
      icon: b.icon ?? null,
      rarity: b.rarity ?? "common",
      meta: b.meta ?? {},
    }));

    const { error: upsertErr } = await supabaseServer
      .from("letter_items")
      .upsert(rows, { onConflict: "letter_id,kind,code" });

    if (upsertErr) {
      // don't hard-fail the whole status page for badges;
      // but do log it so you notice during dev
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