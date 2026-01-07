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

function safeParseMs(iso: unknown): number | null {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
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
 * ✅ do NOT clamp to US-only offsets.
 * Use world-ish bounds: UTC-12..UTC+14
 */
function offsetMinutesFromLon(lon: number) {
  if (!Number.isFinite(lon)) return 0;
  const hours = Math.round(lon / 15);
  return clamp(hours * 60, -12 * 60, 14 * 60);
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

  const mkLocal = (yy: number, mm: number, dd: number, hh: number) =>
    Date.UTC(yy, mm, dd, hh, 0, 0, 0);

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

  const candidatesUtc = candidatesLocal
    .map((lm) => toUtcMs(lm, offsetMin))
    .filter((t) => t > utcMs + 1);

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

function etaFromRequiredAwakeMs(
  sentUtcMs: number,
  requiredAwakeMs: number,
  offsetMin: number,
  cfg: SleepConfig = SLEEP
) {
  let t = sentUtcMs;
  let remaining = requiredAwakeMs;

  let guard = 0;
  while (remaining > 0 && guard < 100000) {
    guard++;

    const sleeping = isSleepingAt(t, offsetMin, cfg);
    const next = nextBoundaryUtcMs(t, offsetMin, cfg);

    if (!Number.isFinite(next) || next <= t) {
      return sentUtcMs + requiredAwakeMs;
    }

    if (sleeping) {
      t = next;
      continue;
    }

    const chunk = Math.min(remaining, next - t);
    remaining -= chunk;
    t += chunk;
  }

  if (remaining > 0) return sentUtcMs + requiredAwakeMs;

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

type Direction = "sent" | "incoming";
type RawLetter = any;

function matchesQuerySent(l: RawLetter, q: string) {
  const hay = [l.subject, l.to_name, l.to_email, l.origin_name, l.dest_name, l.public_token]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function matchesQueryIncoming(l: RawLetter, q: string) {
  const hay = [l.subject, l.from_name, l.from_email, l.origin_name, l.dest_name, l.public_token]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function computeViewModel(l: RawLetter, cps: any[], realNowMs: number, direction: Direction) {
  const bird = normalizeBird(l.bird);
  const ignoresSleep = BIRD_RULES[bird].ignoresSleep;

  const sentMs = safeParseMs(l.sent_at);
  const etaStoredMs = safeParseMs(l.eta_at);

  const canceledAtMs = safeParseMs(l.canceled_at);
  const canceled = canceledAtMs != null && Number.isFinite(canceledAtMs);

  // ✅ If canceled, freeze calculations at cancel time (not "now")
  const calcNowMs = canceled ? Math.min(realNowMs, canceledAtMs!) : realNowMs;

  const originLon = Number(l.origin_lon);
  const offsetMin = offsetMinutesFromLon(originLon);

  const distanceKm = Number(l.distance_km);
  const speedKmh = Number(l.speed_kmh);

  const hasFlightInputs =
    sentMs != null &&
    Number.isFinite(distanceKm) &&
    distanceKm > 0 &&
    Number.isFinite(speedKmh) &&
    speedKmh > 0;

  const requiredAwakeMs = hasFlightInputs ? (distanceKm / speedKmh) * 3600_000 : 0;

  // ✅ Compute adjusted ETA if we safely can; otherwise fall back to stored eta_at.
  let etaAdjustedMs: number | null = null;
  if (sentMs != null && requiredAwakeMs > 0) {
    etaAdjustedMs = ignoresSleep
      ? sentMs + requiredAwakeMs
      : etaFromRequiredAwakeMs(sentMs, requiredAwakeMs, offsetMin);
  } else if (etaStoredMs != null) {
    etaAdjustedMs = etaStoredMs;
  }

  // ✅ Last-resort fallback: "deliver now" if we have neither.
  if (etaAdjustedMs == null) etaAdjustedMs = calcNowMs;

  // ✅ Delivered is false if canceled (even if time would have passed)
  const delivered = canceled ? false : calcNowMs >= etaAdjustedMs;

  // ✅ sleeping flag for dashboard (never sleeping if canceled)
  const sleeping = canceled ? false : !delivered && !ignoresSleep ? isSleepingAt(calcNowMs, offsetMin) : false;

  // ✅ progress (sleep-aware)
  let traveledMs = 0;
  if (sentMs != null && calcNowMs > sentMs && requiredAwakeMs > 0) {
    traveledMs = ignoresSleep
      ? Math.min(calcNowMs, etaAdjustedMs) - sentMs
      : awakeMsBetween(sentMs, Math.min(calcNowMs, etaAdjustedMs), offsetMin);
  }
  const progress = requiredAwakeMs > 0 ? clamp(traveledMs / requiredAwakeMs, 0, 1) : delivered ? 1 : 0;

  // Current label: last checkpoint whose time has passed
  let current_over_text = delivered ? "Delivered" : "somewhere over the U.S.";

  if (canceled) {
    current_over_text = "Canceled";
  } else if (!delivered && cps.length) {
    let best = cps[0];
    let bestT = -Infinity;

    for (const cp of cps) {
      const t = safeParseMs(cp.at);
      if (t != null && t <= calcNowMs && t >= bestT) {
        bestT = t;
        best = cp;
      }
    }

    if (Number.isFinite(best?.lat) && Number.isFinite(best?.lon)) {
      current_over_text = checkpointGeoText(best.lat, best.lon);
    }
  }

  // thumb coords: progress-based
  const curLat =
    Number.isFinite(l.origin_lat) && Number.isFinite(l.dest_lat)
      ? l.origin_lat + (l.dest_lat - l.origin_lat) * progress
      : null;

  const curLon =
    Number.isFinite(l.origin_lon) && Number.isFinite(l.dest_lon)
      ? l.origin_lon + (l.dest_lon - l.origin_lon) * progress
      : null;

  // ETA fields:
  const etaAdjustedISO = new Date(etaAdjustedMs).toISOString();
  const canceledISO = canceledAtMs ? new Date(canceledAtMs).toISOString() : null;

  const eta_utc_iso = canceled ? canceledISO : etaAdjustedISO;
  const eta_utc_text = canceled
    ? canceledISO
      ? `Canceled at ${formatUTC(canceledISO)} UTC`
      : "Canceled"
    : etaAdjustedISO
    ? `${formatUTC(etaAdjustedISO)} UTC`
    : "";

  return {
    ...l,
    direction, // ✅ NEW

    bird,

    canceled,
    canceled_at: canceledISO,

    delivered,
    sleeping,
    progress,

    current_lat: curLat,
    current_lon: curLon,

    current_over_text,

    sent_utc_text: l.sent_at ? `${formatUTC(l.sent_at)} UTC` : "",
    eta_utc_text,
    eta_utc_iso: eta_utc_iso || null,

    badges_count: 0,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const qRaw = (searchParams.get("q") || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // --- Sent letters ---
  const { data: sentData, error: sentErr } = await supabaseServer
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
      canceled_at,
      bird,
      recipient_archived_at
    `
    )
    .eq("from_email", email)
    .or("archived_at.is.null,canceled_at.not.is.null")
    .order("sent_at", { ascending: false })
    .limit(50);

  if (sentErr) {
    return NextResponse.json({ error: sentErr.message }, { status: 500 });
  }

  // --- Incoming letters (NEW) ---
  // ✅ recipient_archived_at hides only from the recipient’s dashboard
  const { data: incomingData, error: incomingErr } = await supabaseServer
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
      canceled_at,
      bird,
      recipient_archived_at
    `
    )
    .eq("to_email", email)
    .is("recipient_archived_at", null)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (incomingErr) {
    return NextResponse.json({ error: incomingErr.message }, { status: 500 });
  }

  let sentLetters = (sentData ?? []) as RawLetter[];
  let incomingLetters = (incomingData ?? []) as RawLetter[];

  // Server-side search filter (kept fast + consistent)
  if (qRaw) {
    sentLetters = sentLetters.filter((l) => matchesQuerySent(l, qRaw));
    incomingLetters = incomingLetters.filter((l) => matchesQueryIncoming(l, qRaw));
  }

  // Gather checkpoints for BOTH sets
  const realNowMs = Date.now();
  const all = [...sentLetters, ...incomingLetters];
  const letterIds = all.map((l: any) => l.id).filter(Boolean);

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

  // Compute view models
  let sentOut = sentLetters.map((l: any) =>
    computeViewModel(l, checkpointsByLetter.get(l.id) ?? [], realNowMs, "sent")
  );
  let incomingOut = incomingLetters.map((l: any) =>
    computeViewModel(l, checkpointsByLetter.get(l.id) ?? [], realNowMs, "incoming")
  );

  // Badge counts (cheap) for BOTH sets
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
      sentOut = sentOut.map((l: any) => ({ ...l, badges_count: counts.get(l.id) ?? 0 }));
      incomingOut = incomingOut.map((l: any) => ({ ...l, badges_count: counts.get(l.id) ?? 0 }));
    }
  }

  // ✅ Backward compatible:
  // - `letters` remains the original Sent list so older UI doesn’t explode
  // - new fields are for your Incoming tab UI
  return NextResponse.json({
    letters: sentOut,
    sentLetters: sentOut,
    incomingLetters: incomingOut,
  });
}