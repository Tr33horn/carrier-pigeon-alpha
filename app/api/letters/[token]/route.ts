import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

// ✅ geo helpers
import { checkpointGeoText, geoRegionForPoint } from "../../../lib/geo";

/* -------------------------------------------------
   Sleep / flight realism helpers (self-contained)
------------------------------------------------- */

type SleepConfig = {
  sleepStartHour: number; // local hour 0-23
  sleepEndHour: number; // local hour 0-23
};

const SLEEP: SleepConfig = { sleepStartHour: 22, sleepEndHour: 6 }; // 10pm -> 6am (8h)

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Rough “local time” offset from longitude (good vibe > perfect geography)
 * -120 => ~UTC-8, -75 => ~UTC-5
 */
function offsetMinutesFromLon(lon: number) {
  if (!Number.isFinite(lon)) return 0;
  const hours = Math.round(lon / 15); // -120/15=-8
  return clamp(hours * 60, -600, -240); // clamp to US-ish offsets
}

function toLocalMs(utcMs: number, offsetMin: number) {
  return utcMs + offsetMin * 60_000;
}
function toUtcMs(localMs: number, offsetMin: number) {
  return localMs - offsetMin * 60_000;
}

function isSleepingAt(utcMs: number, offsetMin: number, cfg: SleepConfig = SLEEP) {
  const localMs = toLocalMs(utcMs, offsetMin);
  const d = new Date(localMs);
  const h = d.getUTCHours(); // localMs already shifted

  const wraps = cfg.sleepStartHour > cfg.sleepEndHour; // 22 -> 6 wraps
  if (!wraps) return h >= cfg.sleepStartHour && h < cfg.sleepEndHour;
  return h >= cfg.sleepStartHour || h < cfg.sleepEndHour;
}

function nextBoundaryUtcMs(utcMs: number, offsetMin: number, cfg: SleepConfig = SLEEP) {
  const localMs = toLocalMs(utcMs, offsetMin);
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  const wraps = cfg.sleepStartHour > cfg.sleepEndHour;

  const mkLocal = (yy: number, mm: number, dd: number, hh: number) => Date.UTC(yy, mm, dd, hh, 0, 0, 0);

  const todaySleepStartLocal = mkLocal(y, m, day, cfg.sleepStartHour);
  const todaySleepEndLocal = mkLocal(y, m, day, cfg.sleepEndHour);
  const tomorrowStartLocal = mkLocal(y, m, day + 1, cfg.sleepStartHour);
  const tomorrowEndLocal = mkLocal(y, m, day + 1, cfg.sleepEndHour);

  const candidatesLocal: number[] = [];
  candidatesLocal.push(Date.UTC(y, m, day + 1, 0, 0, 0, 0));
  candidatesLocal.push(todaySleepStartLocal);

  if (wraps) {
    candidatesLocal.push(tomorrowEndLocal);
  } else {
    candidatesLocal.push(todaySleepEndLocal);
  }

  candidatesLocal.push(tomorrowStartLocal);
  candidatesLocal.push(tomorrowEndLocal);

  const candidatesUtc = candidatesLocal.map((lm) => toUtcMs(lm, offsetMin)).filter((t) => t > utcMs + 1);

  if (!candidatesUtc.length) return utcMs + 3600_000;
  return Math.min(...candidatesUtc);
}

function awakeMsBetween(startUtcMs: number, endUtcMs: number, offsetMin: number, cfg: SleepConfig = SLEEP) {
  if (endUtcMs <= startUtcMs) return 0;

  let t = startUtcMs;
  let awake = 0;

  let guard = 0;
  while (t < endUtcMs && guard < 100000) {
    guard++;
    const sleeping = isSleepingAt(t, offsetMin, cfg);
    const next = Math.min(nextBoundaryUtcMs(t, offsetMin, cfg), endUtcMs);
    if (!sleeping) awake += next - t;
    t = next;
  }

  return awake;
}

function etaFromRequiredAwakeMs(sentUtcMs: number, requiredAwakeMs: number, offsetMin: number, cfg: SleepConfig = SLEEP) {
  let t = sentUtcMs;
  let remaining = requiredAwakeMs;

  let guard = 0;
  while (remaining > 0 && guard < 100000) {
    guard++;

    const sleeping = isSleepingAt(t, offsetMin, cfg);
    const next = nextBoundaryUtcMs(t, offsetMin, cfg);

    if (sleeping) {
      t = next;
      continue;
    }

    const chunk = Math.min(remaining, next - t);
    remaining -= chunk;
    t += chunk;
  }

  return t;
}

function nextWakeUtcMs(nowUtcMs: number, offsetMin: number, cfg: SleepConfig = SLEEP) {
  if (!isSleepingAt(nowUtcMs, offsetMin, cfg)) return null;

  let t = nowUtcMs;
  let guard = 0;

  while (guard < 10000) {
    guard++;
    const next = nextBoundaryUtcMs(t, offsetMin, cfg);
    t = next;
    if (!isSleepingAt(t + 1, offsetMin, cfg)) return t;
  }

  return null;
}

function sleepUntilLocalText(sleepUntilUtcMs: number, offsetMin: number) {
  const localMs = toLocalMs(sleepUntilUtcMs, offsetMin);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(localMs));
}

function stripOverPrefix(s: string) {
  return (s || "").replace(/^over\s+/i, "").trim();
}

/**
 * Create “<Bird> slept …” events as synthetic checkpoints
 */
function buildSleepEvents(args: {
  sentMs: number;
  nowMs: number;
  offsetMin: number;
  birdLabel?: string; // ✅ NEW (pigeon/goose wording)
  cfg?: SleepConfig;
}) {
  const { sentMs, nowMs, offsetMin } = args;
  const cfg = args.cfg ?? SLEEP;
  const birdLabel = (args.birdLabel || "Pigeon").trim() || "Pigeon";

  if (!Number.isFinite(sentMs) || !Number.isFinite(nowMs) || nowMs <= sentMs) return [];

  const localStart = new Date(toLocalMs(sentMs, offsetMin));
  const localEnd = new Date(toLocalMs(nowMs, offsetMin));

  const startY = localStart.getUTCFullYear();
  const startM = localStart.getUTCMonth();
  const startD = localStart.getUTCDate();

  const endY = localEnd.getUTCFullYear();
  const endM = localEnd.getUTCMonth();
  const endD = localEnd.getUTCDate();

  const events: any[] = [];

  const tupleLE = (a: [number, number, number], b: [number, number, number]) =>
    a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2])));

  let y = startY,
    m = startM,
    d = startD;

  while (tupleLE([y, m, d], [endY, endM, endD])) {
    const wraps = cfg.sleepStartHour > cfg.sleepEndHour;

    const sleepStartLocal = Date.UTC(y, m, d, cfg.sleepStartHour, 0, 0, 0);
    const sleepEndLocal = wraps
      ? Date.UTC(y, m, d + 1, cfg.sleepEndHour, 0, 0, 0)
      : Date.UTC(y, m, d, cfg.sleepEndHour, 0, 0, 0);

    const sleepStartUtc = toUtcMs(sleepStartLocal, offsetMin);
    const sleepEndUtc = toUtcMs(sleepEndLocal, offsetMin);

    if (sleepStartUtc <= nowMs && sleepEndUtc >= sentMs) {
      const started = Math.max(sleepStartUtc, sentMs);
      const wake = sleepEndUtc;

      if (started <= nowMs) {
        const wakeText = sleepUntilLocalText(wake, offsetMin);
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
          name: `${birdLabel} slept — wakes at ${wakeText}`,
          _sleep_meta: {
            sleep_start_utc: new Date(sleepStartUtc).toISOString(),
            sleep_end_utc: new Date(sleepEndUtc).toISOString(),
            wake_local_text: wakeText,
          },
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

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

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

  // ✅ Bird behavior
  const rawBird = String((meta as any).bird || "pigeon").toLowerCase();
  const bird: "pigeon" | "snipe" | "goose" = rawBird === "snipe" || rawBird === "goose" ? rawBird : "pigeon";

  const BIRD_RULES = {
    pigeon: { ignoresSleep: false, sleepLabel: "Pigeon" },
    goose: { ignoresSleep: false, sleepLabel: "Goose" },
    snipe: { ignoresSleep: true, sleepLabel: "Snipe" },
  } as const;

  const ignoresSleep = BIRD_RULES[bird].ignoresSleep;

  // ✅ archived handling (freeze time)
  const archived_at = meta.archived_at ?? null;
  const archivedAtMs = archived_at ? Date.parse(archived_at) : NaN;
  const archived = !!archived_at && Number.isFinite(archivedAtMs);

  const realNowMs = Date.now();
  const nowMs = archived ? Math.min(realNowMs, archivedAtMs) : realNowMs;

  // ✅ server snapshot time fields for client
  const server_now_iso = new Date(nowMs).toISOString();
  const server_now_utc_text = formatUtc(server_now_iso);

  // Fetch checkpoints
  const { data: checkpoints, error: cErr } = await supabaseServer
    .from("letter_checkpoints")
    .select("id, idx, name, at, lat, lon")
    .eq("letter_id", meta.id)
    .order("idx", { ascending: true });

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const sentMs = Date.parse(meta.sent_at);

  // ✅ Flight math
  const offsetMin = offsetMinutesFromLon(meta.origin_lon);

  const requiredAwakeMs = meta.speed_kmh > 0 ? (meta.distance_km / meta.speed_kmh) * 3600_000 : 0;

  const etaAdjustedMs =
    Number.isFinite(sentMs) && requiredAwakeMs > 0
      ? ignoresSleep
        ? sentMs + requiredAwakeMs
        : etaFromRequiredAwakeMs(sentMs, requiredAwakeMs, offsetMin)
      : Date.parse(meta.eta_at);

  const delivered = Number.isFinite(etaAdjustedMs) ? nowMs >= etaAdjustedMs : true;

  const awakeSoFar =
    Number.isFinite(sentMs) && nowMs > sentMs
      ? ignoresSleep
        ? Math.min(nowMs, etaAdjustedMs) - sentMs
        : awakeMsBetween(sentMs, Math.min(nowMs, etaAdjustedMs), offsetMin)
      : 0;

  const progress = requiredAwakeMs > 0 ? clamp(awakeSoFar / requiredAwakeMs, 0, 1) : 1;

  const sleeping = archived ? false : ignoresSleep ? false : isSleepingAt(nowMs, offsetMin);
  const wakeMs = archived ? null : ignoresSleep ? null : nextWakeUtcMs(nowMs, offsetMin);
  const sleep_until_iso = wakeMs ? new Date(wakeMs).toISOString() : null;
  const sleep_local_text = wakeMs ? sleepUntilLocalText(wakeMs, offsetMin) : "";

  // Only fetch body AFTER delivery
  let body: string | null = null;
  if (delivered) {
    const { data: bodyRow } = await supabaseServer.from("letters").select("body").eq("id", meta.id).single();
    body = bodyRow?.body ?? null;
  }

  // ✅ Upgrade checkpoint labels + add geo_text + region_id
  const cpsBase = (checkpoints ?? []).map((cp: any, i: number, arr: any[]) => {
    const isFirst = i === 0;
    const isLast = i === arr.length - 1;

    const geo =
      Number.isFinite(cp.lat) && Number.isFinite(cp.lon) ? checkpointGeoText(cp.lat, cp.lon) : "somewhere over the U.S.";

    const region =
      Number.isFinite(cp.lat) && Number.isFinite(cp.lon) ? geoRegionForPoint(cp.lat, cp.lon) : null;

    const upgradedName = isFirst ? `Departed roost — ${geo}` : isLast ? `Final descent — ${geo}` : geo;

    return {
      ...cp,
      kind: "checkpoint",
      geo_text: geo,
      region_id: region?.id ?? null,
      region_label: region?.label ?? null,
      name: upgradedName,
    };
  });

  const sleepEvents =
    !archived && !ignoresSleep && Number.isFinite(sentMs)
      ? buildSleepEvents({
          sentMs,
          nowMs,
          offsetMin,
          birdLabel: BIRD_RULES[bird].sleepLabel,
        })
      : [];

  const cps = [...cpsBase, ...sleepEvents].sort((a: any, b: any) => Date.parse(a.at) - Date.parse(b.at));

  let current_over_text = delivered ? "Delivered" : "somewhere over the U.S.";
  if (!delivered && cpsBase.length) {
    let cur = cpsBase[0];
    for (const cp of cpsBase) {
      const t = Date.parse(cp.at);
      if (Number.isFinite(t) && t <= nowMs) cur = cp;
      else break;
    }
    current_over_text = cur?.geo_text || current_over_text;
  }

  const geoBase = delivered ? "Delivered" : stripOverPrefix(current_over_text);
  const tooltip_text = delivered
    ? `Location: Delivered`
    : sleeping
    ? `Location: Sleeping — ${geoBase || "somewhere over the U.S."}`
    : `Location: ${geoBase || "somewhere over the U.S."}`;

  // ✅ Award badges (past checkpoints only — NOT sleep events)
  const past = cpsBase.filter((cp: any) => {
    const t = Date.parse(cp.at);
    return Number.isFinite(t) && t <= nowMs;
  });

  const pastRegionIds = past.map((cp: any) => cp.region_id).filter(Boolean) as string[];

  const originRegion =
    Number.isFinite(meta.origin_lat) && Number.isFinite(meta.origin_lon) ? geoRegionForPoint(meta.origin_lat, meta.origin_lon) : null;

  const destRegion =
    Number.isFinite(meta.dest_lat) && Number.isFinite(meta.dest_lon) ? geoRegionForPoint(meta.dest_lat, meta.dest_lon) : null;

  const deliveredAtISO =
    delivered && Number.isFinite(etaAdjustedMs)
      ? new Date(etaAdjustedMs).toISOString()
      : delivered
      ? new Date(nowMs).toISOString()
      : undefined;

  const computedBadges = computeBadgesFromRegions({
    origin: { name: meta.origin_name, regionId: originRegion?.id ?? null },
    dest: { name: meta.dest_name, regionId: destRegion?.id ?? null },
    pastRegionIds,
    delivered,
    deliveredAtISO,
  });

  if (!archived && computedBadges.length) {
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

    const { error: upsertErr } = await supabaseServer.from("letter_items").upsert(rows, { onConflict: "letter_id,kind,code" });
    if (upsertErr) console.error("BADGE UPSERT ERROR:", upsertErr);
  }

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

  const etaAdjustedISO = Number.isFinite(etaAdjustedMs) ? new Date(etaAdjustedMs).toISOString() : meta.eta_at;

  return NextResponse.json({
    archived,
    archived_at: archived ? archived_at : null,

    server_now_iso,
    server_now_utc_text,

    letter: {
      ...meta,
      bird,
      body,

      eta_at_adjusted: etaAdjustedISO,
      eta_utc_text: formatUtc(etaAdjustedISO),

      archived_at: archived ? archived_at : null,
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
      marker_mode: delivered ? "delivered" : sleeping ? "sleeping" : "flying",
    },

    items: { badges, addons },
  });
}