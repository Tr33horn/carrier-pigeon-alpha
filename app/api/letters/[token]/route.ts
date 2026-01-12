import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

// ✅ geo helpers
import { checkpointGeoText, geoRegionForPoint } from "../../../lib/geo";

// ✅ Use the shared sleep logic (NO local duplicates)
import {
  offsetMinutesFromLon,
  isSleepingAt,
  awakeMsBetween,
  etaFromRequiredAwakeMs,
  nextWakeUtcMs,
  sleepUntilLocalText,
  initialSleepSkipUntilUtcMs,
  type SleepConfig,
} from "@/app/lib/flightSleep";

// ✅ Single source of truth for bird rules
import { BIRD_RULES, normalizeBird, type BirdType } from "@/app/lib/birds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -------------------------------------------------
   tiny helpers
------------------------------------------------- */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function stripOverPrefix(s: string) {
  return (s || "").replace(/^over\s+/i, "").trim();
}

/** Normalize “Over ___” output for UI/email consistency */
function ensureOver(s: string) {
  const raw = (s || "").trim();
  if (!raw) return "";

  // terminal-ish words should remain as-is
  if (/^(delivered|canceled|cancelled|sleeping)$/i.test(raw)) return raw;

  // already has “over”
  if (/^over\s+/i.test(raw)) return raw.replace(/^over\s+/i, "Over ");

  // your geo helper sometimes returns “somewhere over the U.S.” — keep it
  if (/over\s+/i.test(raw)) return raw;

  return `Over ${raw}`;
}

/* -------------------------------------------------
   Formatting
------------------------------------------------- */

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
  earned_at?: string;
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

function computeBadgesFromRegions(args: {
  origin?: { name?: string; regionId?: string | null };
  dest?: { name?: string; regionId?: string | null };
  pastRegionIds: string[];
  delivered?: boolean;
  deliveredAtISO?: string;
}) {
  const { pastRegionIds, delivered, deliveredAtISO } = args;

  const seq: string[] = [];
  for (const r of pastRegionIds) {
    if (!r) continue;
    if (seq.length === 0 || seq[seq.length - 1] !== r) seq.push(r);
  }

  const has = (id: string) => seq.includes(id);
  const crossed = (regionId: string) => {
    const i = seq.indexOf(regionId);
    return i !== -1 && i < seq.length - 1;
  };

  const out: BadgeDef[] = [];

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

  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.code) ? false : (seen.add(b.code), true)));
}

/* -------------------------------------------------
   Skip-initial-sleep helpers (uses flightSleep.ts)
------------------------------------------------- */

function computeInitialSleepSkip(sentMs: number, offsetMin: number, cfg: SleepConfig, ignoresSleep: boolean) {
  if (ignoresSleep) return { skipUntilMs: null as number | null };
  if (!Number.isFinite(sentMs)) return { skipUntilMs: null as number | null };

  const wake = initialSleepSkipUntilUtcMs(sentMs, offsetMin, cfg);
  if (!wake || !Number.isFinite(wake) || wake <= sentMs) return { skipUntilMs: null };

  // Treat [sentMs..wake) as "awake" for progress/ETA math.
  return { skipUntilMs: wake };
}

function awakeMsBetweenWithSkip(
  startMs: number,
  endMs: number,
  offsetMin: number,
  cfg: SleepConfig,
  skipUntilMs: number | null,
  ignoresSleep: boolean
) {
  if (endMs <= startMs) return 0;
  if (ignoresSleep) return endMs - startMs;

  if (skipUntilMs && startMs < skipUntilMs) {
    const a = startMs;
    const b = Math.min(endMs, skipUntilMs);
    const awakeInSkip = Math.max(0, b - a);

    if (endMs <= skipUntilMs) return awakeInSkip;

    return awakeInSkip + awakeMsBetween(skipUntilMs, endMs, offsetMin, cfg);
  }

  return awakeMsBetween(startMs, endMs, offsetMin, cfg);
}

function etaFromRequiredAwakeMsWithSkip(
  sentMs: number,
  requiredAwakeMs: number,
  offsetMin: number,
  cfg: SleepConfig,
  skipUntilMs: number | null,
  ignoresSleep: boolean
) {
  if (requiredAwakeMs <= 0) return sentMs;
  if (ignoresSleep) return sentMs + requiredAwakeMs;

  if (skipUntilMs && sentMs < skipUntilMs) {
    const initialAwakeBudget = skipUntilMs - sentMs;
    if (requiredAwakeMs <= initialAwakeBudget) return sentMs + requiredAwakeMs;
    const remaining = requiredAwakeMs - initialAwakeBudget;
    return etaFromRequiredAwakeMs(skipUntilMs, remaining, offsetMin, cfg);
  }

  return etaFromRequiredAwakeMs(sentMs, requiredAwakeMs, offsetMin, cfg);
}

/* -------------------------------------------------
   Sleep events: synthetic checkpoints (timeline only)
------------------------------------------------- */

function buildSleepEvents(args: {
  sentMs: number;
  nowMs: number;
  offsetMin: number;
  birdLabel?: string;
  cfg: SleepConfig;
}) {
  const { sentMs, nowMs, offsetMin, cfg } = args;
  const birdLabel = (args.birdLabel || "Pigeon").trim() || "Pigeon";

  if (!Number.isFinite(sentMs) || !Number.isFinite(nowMs) || nowMs <= sentMs) return [];

  const localStart = new Date(sentMs + offsetMin * 60_000);
  const localEnd = new Date(nowMs + offsetMin * 60_000);

  const startY = localStart.getUTCFullYear();
  const startM = localStart.getUTCMonth();
  const startD = localStart.getUTCDate();

  const endY = localEnd.getUTCFullYear();
  const endM = localEnd.getUTCMonth();
  const endD = localEnd.getUTCDate();

  const tupleLE = (a: [number, number, number], b: [number, number, number]) =>
    a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2])));

  const events: any[] = [];
  let y = startY,
    m = startM,
    d = startD;

  while (tupleLE([y, m, d], [endY, endM, endD])) {
    const wraps = cfg.sleepStartHour > cfg.sleepEndHour;

    const sleepStartLocal = Date.UTC(y, m, d, cfg.sleepStartHour, 0, 0, 0);
    const sleepEndLocal = wraps
      ? Date.UTC(y, m, d + 1, cfg.sleepEndHour, 0, 0, 0)
      : Date.UTC(y, m, d, cfg.sleepEndHour, 0, 0, 0);

    const sleepStartUtc = sleepStartLocal - offsetMin * 60_000;
    const sleepEndUtc = sleepEndLocal - offsetMin * 60_000;

    if (sleepStartUtc <= nowMs && sleepEndUtc >= sentMs) {
      const started = Math.max(sleepStartUtc, sentMs);
      const wake = sleepEndUtc;

      if (started <= nowMs) {
        const wakeText = sleepUntilLocalText(wake, offsetMin);
        const verb = wake <= nowMs ? "awoke at" : "wakes at";

        events.push({
          id: `sleep-${y}-${m + 1}-${d}`,
          idx: 10_000 + events.length,
          kind: "sleep",
          at: new Date(started).toISOString(),
          lat: null,
          lon: null,
          geo_text: "Sleeping",
          region_id: null,
          region_label: null,
          name: `${birdLabel} slept — ${verb} ${wakeText}`,
        });
      }
    }

    const next = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    y = next.getUTCFullYear();
    m = next.getUTCMonth();
    d = next.getUTCDate();
  }

  return events.filter((e) => Date.parse(e.at) <= nowMs);
}

/* -------------------------------------------------
   Route handler
------------------------------------------------- */

export async function GET(_req: NextRequest, ctx: { params: { token: string } }) {
  const { token } = ctx.params;

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
      eta_at,
      archived_at,
      canceled_at,
      bird
    `
    )
    .eq("public_token", token)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (metaErr || !meta) {
    return NextResponse.json({ error: metaErr?.message ?? "Not found" }, { status: 404 });
  }

  // Normalize numerics (Supabase can return strings)
  const speedKmhRaw = Number((meta as any).speed_kmh);
  const distanceKm = Number((meta as any).distance_km);

  const originLon = Number((meta as any).origin_lon);
  const originLat = Number((meta as any).origin_lat);
  const destLon = Number((meta as any).dest_lon);
  const destLat = Number((meta as any).dest_lat);

  // ✅ Bird behavior (single source of truth)
  const bird: BirdType = normalizeBird((meta as any).bird);
  const birdRule = BIRD_RULES[bird];
  const ignoresSleep = birdRule.ignoresSleep;
  const sleepCfg = birdRule.sleepCfg;

  // ✅ archived handling (freeze time)
  const archived_at = (meta as any).archived_at ?? null;
  const archivedAtMs = archived_at ? Date.parse(archived_at) : NaN;
  const archived = !!archived_at && Number.isFinite(archivedAtMs);

  const realNowMs = Date.now();
  const nowMs = archived ? Math.min(realNowMs, archivedAtMs) : realNowMs;

  // ✅ canceled handling (terminal) — freeze at cancel time
  const canceled_at = (meta as any).canceled_at ?? null;
  const canceledAtMs = canceled_at ? Date.parse(canceled_at) : NaN;
  const canceled = !!canceled_at && Number.isFinite(canceledAtMs);

  const nowMsFinal = canceled ? Math.min(nowMs, canceledAtMs) : nowMs;

  // ✅ server snapshot time fields for client (freeze if canceled/archived)
  const server_now_iso = new Date(nowMsFinal).toISOString();
  const server_now_utc_text = formatUtc(server_now_iso);

  // Fetch checkpoints (static positions)
  const { data: checkpoints, error: cErr } = await supabaseServer
    .from("letter_checkpoints")
    .select("id, idx, name, at, lat, lon")
    .eq("letter_id", (meta as any).id)
    .order("idx", { ascending: true });

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const sentMs = Date.parse((meta as any).sent_at);

  // ✅ Flight "timezone": midpoint longitude (matches send route)
  const hasOLon = Number.isFinite(originLon);
  const hasDLon = Number.isFinite(destLon);
  const midLon = hasOLon && hasDLon ? (originLon + destLon) / 2 : hasOLon ? originLon : hasDLon ? destLon : 0;
  const offsetMin = offsetMinutesFromLon(midLon);

  // ✅ Required awake ms MUST match send route: km/speed * inefficiency
  const speedKmh = Number.isFinite(speedKmhRaw) && speedKmhRaw > 0 ? speedKmhRaw : 0;
  const requiredAwakeMs =
    speedKmh > 0 && Number.isFinite(distanceKm) && distanceKm > 0
      ? (distanceKm / speedKmh) * birdRule.inefficiency * 3600_000
      : 0;

  // ✅ Skip-initial-sleep policy
  const { skipUntilMs } = computeInitialSleepSkip(sentMs, offsetMin, sleepCfg, ignoresSleep);

  // ✅ ETA adjusted: based on awake-time, plus skip policy
  const etaAdjustedMs =
    Number.isFinite(sentMs) && requiredAwakeMs > 0
      ? etaFromRequiredAwakeMsWithSkip(sentMs, requiredAwakeMs, offsetMin, sleepCfg, skipUntilMs, ignoresSleep)
      : Date.parse((meta as any).eta_at);

  // ✅ delivered is false if canceled (even if time would have passed)
  const delivered = canceled ? false : Number.isFinite(etaAdjustedMs) ? nowMsFinal >= etaAdjustedMs : true;

  const awakeSoFar =
    Number.isFinite(sentMs) && nowMsFinal > sentMs
      ? awakeMsBetweenWithSkip(sentMs, Math.min(nowMsFinal, etaAdjustedMs), offsetMin, sleepCfg, skipUntilMs, ignoresSleep)
      : 0;

  const progress = requiredAwakeMs > 0 ? clamp(awakeSoFar / requiredAwakeMs, 0, 1) : 1;

  // ✅ sleeping/wake disabled if archived or canceled
  // ✅ ALSO: if we are in the initial skipped segment, we force sleeping=false
  const inSkip = !!(skipUntilMs && nowMsFinal < skipUntilMs);

  const sleeping =
    archived || canceled
      ? false
      : ignoresSleep
      ? false
      : inSkip
      ? false
      : isSleepingAt(nowMsFinal, offsetMin, sleepCfg);

  const wakeMs =
    archived || canceled ? null : ignoresSleep ? null : sleeping ? nextWakeUtcMs(nowMsFinal, offsetMin, sleepCfg) : null;

  const sleep_until_iso = wakeMs ? new Date(wakeMs).toISOString() : null;
  const sleep_local_text = wakeMs ? sleepUntilLocalText(wakeMs, offsetMin) : "";

  const current_speed_kmh = canceled || delivered ? 0 : sleeping ? 0 : speedKmh;

  // ✅ Only fetch body AFTER delivery (and never for canceled)
  let body: string | null = null;
  if (delivered && !canceled) {
    const { data: bodyRow } = await supabaseServer.from("letters").select("body").eq("id", (meta as any).id).single();
    body = bodyRow?.body ?? null;
  }

  /**
   * ✅ Retiming checkpoints to respect sleep:
   * Each checkpoint represents a fraction of requiredAwakeMs, not a fraction of wall time.
   * This makes the timeline match your sleep-aware progress.
   */
  const cpsBase = (checkpoints ?? []).map((cp: any, i: number, arr: any[]) => {
    const isFirst = i === 0;
    const isLast = i === arr.length - 1;

    const geo =
      Number.isFinite(cp.lat) && Number.isFinite(cp.lon) ? checkpointGeoText(cp.lat, cp.lon) : "somewhere over the U.S.";
    const region = Number.isFinite(cp.lat) && Number.isFinite(cp.lon) ? geoRegionForPoint(cp.lat, cp.lon) : null;

    const frac = arr.length <= 1 ? 1 : i / (arr.length - 1);

    const atMs =
      Number.isFinite(sentMs) && requiredAwakeMs > 0 && Number.isFinite(etaAdjustedMs)
        ? etaFromRequiredAwakeMsWithSkip(sentMs, requiredAwakeMs * frac, offsetMin, sleepCfg, skipUntilMs, ignoresSleep)
        : Date.parse(cp.at);

    const atISO = Number.isFinite(atMs) ? new Date(atMs).toISOString() : cp.at;

    const upgradedName = isFirst ? `Departed roost — ${geo}` : isLast ? `Final descent — ${geo}` : geo;

    return {
      ...cp,
      kind: "checkpoint",
      at: atISO,
      geo_text: geo,
      region_id: region?.id ?? null,
      region_label: region?.label ?? null,
      name: upgradedName,
    };
  });

  /**
   * ✅ Sleep events:
   * Start from skipUntilMs if we skipped the initial sleep window
   * so the timeline doesn’t show “slept” immediately after sending.
   */
  const sleepEvents =
    !archived && !canceled && !ignoresSleep && Number.isFinite(sentMs)
      ? buildSleepEvents({
          sentMs: skipUntilMs ?? sentMs,
          nowMs: nowMsFinal,
          offsetMin,
          birdLabel: birdRule.sleepLabel,
          cfg: sleepCfg,
        })
      : [];

  const cps = [...cpsBase, ...sleepEvents].sort((a: any, b: any) => Date.parse(a.at) - Date.parse(b.at));

  // ✅ Current over text respects canceled
  let current_over_text = canceled ? "Canceled" : delivered ? "Delivered" : "somewhere over the U.S.";
  if (!delivered && !canceled && cpsBase.length) {
    let cur = cpsBase[0];
    for (const cp of cpsBase) {
      const t = Date.parse(cp.at);
      if (Number.isFinite(t) && t <= nowMsFinal) cur = cp;
      else break;
    }
    current_over_text = ensureOver(cur?.geo_text || current_over_text);
  }

  const geoBase = delivered ? "Delivered" : stripOverPrefix(current_over_text);

  const tooltip_text = canceled
    ? `Location: Canceled`
    : delivered
    ? `Location: Delivered`
    : sleeping
    ? `Location: Sleeping — ${geoBase || "somewhere over the U.S."}`
    : `Location: ${geoBase || "somewhere over the U.S."}`;

  // ✅ Award badges (past checkpoints only — NOT sleep events) — never while canceled
  const past = cpsBase.filter((cp: any) => {
    const t = Date.parse(cp.at);
    return Number.isFinite(t) && t <= nowMsFinal;
  });

  const pastRegionIds = past.map((cp: any) => cp.region_id).filter(Boolean) as string[];

  const originRegion =
    Number.isFinite(originLat) && Number.isFinite(originLon) ? geoRegionForPoint(originLat, originLon) : null;
  const destRegion = Number.isFinite(destLat) && Number.isFinite(destLon) ? geoRegionForPoint(destLat, destLon) : null;

  const deliveredAtISO =
    delivered && Number.isFinite(etaAdjustedMs)
      ? new Date(etaAdjustedMs).toISOString()
      : delivered
      ? new Date(nowMsFinal).toISOString()
      : undefined;

  const computedBadges = computeBadgesFromRegions({
    origin: { name: (meta as any).origin_name, regionId: originRegion?.id ?? null },
    dest: { name: (meta as any).dest_name, regionId: destRegion?.id ?? null },
    pastRegionIds,
    delivered,
    deliveredAtISO,
  });

  // ✅ Never upsert badges if archived OR canceled
  if (!archived && !canceled && computedBadges.length) {
    const earnedAtDefault = new Date(nowMsFinal).toISOString();

    const rows: LetterItemInsert[] = computedBadges.map((b) => ({
      letter_id: (meta as any).id,
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

    if (upsertErr) console.error("BADGE UPSERT ERROR:", upsertErr);
  }

  const { data: items, error: itemsErr } = await supabaseServer
    .from("letter_items")
    .select("id, kind, code, title, subtitle, icon, rarity, earned_at, meta")
    .eq("letter_id", (meta as any).id)
    .order("earned_at", { ascending: true });

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  const badges = (items ?? []).filter((x: any) => x.kind === "badge");
  const addons = (items ?? []).filter((x: any) => x.kind === "addon");

  // ✅ ETA fields:
  // - Normal: adjusted ETA
  // - Canceled: show cancel timestamp
  const etaAdjustedISO = Number.isFinite(etaAdjustedMs) ? new Date(etaAdjustedMs).toISOString() : (meta as any).eta_at;
  const canceledISO = canceled ? new Date(canceledAtMs).toISOString() : null;

  const eta_at_adjusted = canceled ? canceledISO : etaAdjustedISO;
  const eta_utc_text = canceled
    ? canceledISO
      ? `Canceled at ${formatUtc(canceledISO)}`
      : "Canceled"
    : formatUtc(etaAdjustedISO);

  return NextResponse.json(
    {
      archived,
      archived_at: archived ? archived_at : null,

      canceled,
      canceled_at: canceled ? canceled_at : null,

      server_now_iso,
      server_now_utc_text,

      letter: {
        ...meta,
        bird,
        body,

        speed_kmh: speedKmh,

        eta_at_adjusted,
        eta_utc_text,

        archived_at: archived ? archived_at : null,
        canceled_at: canceled ? canceled_at : null,
      },

      checkpoints: cps,
      delivered,
      current_over_text,

      flight: {
        progress,
        sleeping,
        sleep_until_iso,
        sleep_local_text,
        tooltip_text,
        marker_mode: canceled ? "canceled" : delivered ? "delivered" : sleeping ? "sleeping" : "flying",
        current_speed_kmh,
      },

      items: { badges, addons },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}