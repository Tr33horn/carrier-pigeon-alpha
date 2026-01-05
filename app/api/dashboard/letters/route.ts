import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { checkpointGeoText } from "../../../lib/geo";

/* -------------------------------------------------
   Email + formatting
------------------------------------------------- */

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

/* -------------------------------------------------
   Sleep / flight realism helpers (same as status API)
------------------------------------------------- */

type SleepConfig = {
  sleepStartHour: number; // local hour 0-23
  sleepEndHour: number; // local hour 0-23
};

const SLEEP: SleepConfig = { sleepStartHour: 22, sleepEndHour: 6 }; // 10pm -> 6am

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Rough “local time” offset from longitude (good vibe > perfect geography)
 * -120 => ~UTC-8, -75 => ~UTC-5
 */
function offsetMinutesFromLon(lon: number) {
  if (!Number.isFinite(lon)) return 0;
  const hours = Math.round(lon / 15);
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
  const h = d.getUTCHours();
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

  if (wraps) candidatesLocal.push(tomorrowEndLocal);
  else candidatesLocal.push(todaySleepEndLocal);

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

/* -------------------------------------------------
   Bird rules (match status API behavior)
------------------------------------------------- */

type BirdType = "pigeon" | "snipe" | "goose";

function normalizeBird(raw: unknown): BirdType {
  const b = String(raw || "").toLowerCase();
  if (b === "snipe") return "snipe";
  if (b === "goose") return "goose";
  return "pigeon";
}

const BIRD_RULES: Record<BirdType, { ignoresSleep: boolean }> = {
  pigeon: { ignoresSleep: false },
  goose: { ignoresSleep: false },
  snipe: { ignoresSleep: true },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Pull letters (exclude archived)
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
      speed_kmh,
      archived_at,
      bird
    `
    )
    .eq("from_email", email)
    .is("archived_at", null)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const nowMs = Date.now();
  let letters = (data ?? []);

  // Optional server-side search filter
  if (q) {
    letters = letters.filter((l: any) => {
      const hay = [l.subject, l.to_name, l.to_email, l.origin_name, l.dest_name, l.public_token]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  // Only query checkpoints for the filtered set
  const letterIds = letters.map((l: any) => l.id).filter(Boolean);

  // Batch fetch checkpoints for these letters (single query, no N+1)
  const checkpointsByLetter = new Map<string, any[]>();

  if (letterIds.length) {
    const { data: cps, error: cpErr } = await supabaseServer
      .from("letter_checkpoints")
      .select("id, letter_id, idx, at, lat, lon, name")
      .in("letter_id", letterIds)
      .order("idx", { ascending: true });

    if (cpErr) {
      return NextResponse.json({ error: cpErr.message }, { status: 500 });
    }

    for (const cp of cps ?? []) {
      const arr = checkpointsByLetter.get(cp.letter_id) ?? [];
      arr.push(cp);
      checkpointsByLetter.set(cp.letter_id, arr);
    }
  }

  // Map into dashboard payload
  let out = letters.map((l: any) => {
    const sentMs = Date.parse(l.sent_at);
    const originLon = Number(l.origin_lon);

    const bird = normalizeBird(l.bird);
    const ignoresSleep = BIRD_RULES[bird].ignoresSleep;

    const offsetMin = offsetMinutesFromLon(originLon);

    const requiredAwakeMs =
      Number(l.speed_kmh) > 0 ? (Number(l.distance_km) / Number(l.speed_kmh)) * 3600_000 : 0;

    const etaAdjustedMs =
      Number.isFinite(sentMs) && requiredAwakeMs > 0
        ? ignoresSleep
          ? sentMs + requiredAwakeMs
          : etaFromRequiredAwakeMs(sentMs, requiredAwakeMs, offsetMin)
        : Date.parse(l.eta_at);

    const delivered = Number.isFinite(etaAdjustedMs) ? nowMs >= etaAdjustedMs : true;

    // progress should match status page logic
    const traveledMs =
      Number.isFinite(sentMs) && nowMs > sentMs
        ? ignoresSleep
          ? Math.min(nowMs, etaAdjustedMs) - sentMs
          : awakeMsBetween(sentMs, Math.min(nowMs, etaAdjustedMs), offsetMin)
        : 0;

    const progress = requiredAwakeMs > 0 ? clamp(traveledMs / requiredAwakeMs, 0, 1) : 1;

    // Current label: last checkpoint whose time has passed (time-based, not progress-based)
    const cps = checkpointsByLetter.get(l.id) ?? [];
    let current_over_text = delivered ? "Delivered" : "somewhere over the U.S.";

    if (!delivered && cps.length) {
      let best = cps[0];
      let bestT = -Infinity;

      for (const cp of cps) {
        const t = Date.parse(cp.at);
        if (Number.isFinite(t) && t <= nowMs && t >= bestT) {
          bestT = t;
          best = cp;
        }
      }

      if (Number.isFinite(best?.lat) && Number.isFinite(best?.lon)) {
        current_over_text = checkpointGeoText(best.lat, best.lon);
      }
    }

    // Keep "current coords" for the thumb only (progress-based)
    const curLat =
      Number.isFinite(l.origin_lat) && Number.isFinite(l.dest_lat)
        ? l.origin_lat + (l.dest_lat - l.origin_lat) * progress
        : null;

    const curLon =
      Number.isFinite(l.origin_lon) && Number.isFinite(l.dest_lon)
        ? l.origin_lon + (l.dest_lon - l.origin_lon) * progress
        : null;

    const etaAdjustedISO = Number.isFinite(etaAdjustedMs) ? new Date(etaAdjustedMs).toISOString() : l.eta_at;

    return {
      ...l,
      bird,
      delivered,
      progress,
      current_lat: curLat,
      current_lon: curLon,

      // ✅ dashboard should trust this text instead of recomputing
      current_over_text,

      sent_utc_text: l.sent_at ? `${formatUTC(l.sent_at)} UTC` : "",
      eta_utc_text: etaAdjustedISO ? `${formatUTC(etaAdjustedISO)} UTC` : "",
      eta_utc_iso: etaAdjustedISO || null,

      badges_count: 0,
    };
  });

  // ✅ Badge counts (cheap)
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
      out = out.map((l: any) => ({
        ...l,
        badges_count: counts.get(l.id) ?? 0,
      }));
    }
  }

  return NextResponse.json({ letters: out });
}