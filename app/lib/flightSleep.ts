// app/lib/flightSleep.ts

export type SleepConfig = {
  sleepStartHour: number; // 0-23 local
  sleepEndHour: number; // 0-23 local
  // Example: 22 -> 6 means 10pm to 6am (wraps midnight)
};

export const DEFAULT_SLEEP: SleepConfig = { sleepStartHour: 22, sleepEndHour: 6 };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Lightweight fixed "timezone" offset from longitude.
 * 15° ≈ 1 hour. Rounded. Not DST-aware (intentional).
 *
 * ✅ World-ish bounds: UTC-12..UTC+14
 * (Important: don't hard-clamp to US-only offsets, or sleep logic disagrees across the route.)
 */
export function offsetMinutesFromLon(lon: number) {
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

function localYMD(localMs: number) {
  const d = new Date(localMs);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), day: d.getUTCDate() };
}

/**
 * Returns the next boundary in UTC ms where sleep/awake could change.
 * We step by local day boundaries + sleep start/end.
 */
function nextBoundaryUtcMs(utcMs: number, offsetMin: number, cfg: SleepConfig) {
  const localMs = toLocalMs(utcMs, offsetMin);
  const { y, m, day } = localYMD(localMs);

  // build local times (as UTC Date but representing local clock, because we use UTC getters)
  const mkLocal = (hh: number, mm = 0) => Date.UTC(y, m, day, hh, mm, 0, 0);

  // If sleepStartHour > sleepEndHour => window crosses midnight.
  const wraps = cfg.sleepStartHour > cfg.sleepEndHour;

  const candidatesLocal: number[] = [];

  // Always consider end-of-day boundary so we can move forward safely
  candidatesLocal.push(Date.UTC(y, m, day + 1, 0, 0, 0, 0));

  // Sleep start is always a candidate boundary "today"
  candidatesLocal.push(mkLocal(cfg.sleepStartHour));

  // Sleep end may be "today" or "tomorrow" depending on wrap
  if (wraps) {
    candidatesLocal.push(Date.UTC(y, m, day + 1, cfg.sleepEndHour, 0, 0, 0));
  } else {
    candidatesLocal.push(mkLocal(cfg.sleepEndHour));
  }

  // Convert candidates to UTC and pick the soonest > utcMs
  const candidatesUtc = candidatesLocal
    .map((lm) => toUtcMs(lm, offsetMin))
    .filter((t) => t > utcMs + 1); // strictly in the future

  if (!candidatesUtc.length) {
    // fallback: +1 hour (shouldn't really happen, but keeps things safe)
    return utcMs + 3600_000;
  }

  return Math.min(...candidatesUtc);
}

export function isSleepingAt(utcMs: number, offsetMin: number, cfg: SleepConfig = DEFAULT_SLEEP) {
  const localMs = toLocalMs(utcMs, offsetMin);
  const d = new Date(localMs);
  const h = d.getUTCHours(); // because localMs already shifted

  const wraps = cfg.sleepStartHour > cfg.sleepEndHour;

  // Non-wrapping window (e.g. 13..17)
  if (!wraps) {
    // Special case: 0..0 means "never sleeping"
    if (cfg.sleepStartHour === cfg.sleepEndHour) return false;
    return h >= cfg.sleepStartHour && h < cfg.sleepEndHour;
  }

  // Wrapping window (e.g. 22..6)
  return h >= cfg.sleepStartHour || h < cfg.sleepEndHour;
}

/**
 * Accumulate "awake milliseconds" between [startUtcMs, endUtcMs).
 */
export function awakeMsBetween(
  startUtcMs: number,
  endUtcMs: number,
  offsetMin: number,
  cfg: SleepConfig = DEFAULT_SLEEP
) {
  if (endUtcMs <= startUtcMs) return 0;

  let t = startUtcMs;
  let awake = 0;

  while (t < endUtcMs) {
    const sleeping = isSleepingAt(t, offsetMin, cfg);
    const next = Math.min(nextBoundaryUtcMs(t, offsetMin, cfg), endUtcMs);
    if (!sleeping) awake += next - t;
    t = next;
  }

  return awake;
}

/**
 * Given required awake flight time (ms), find ETA in UTC ms starting from sentUtcMs.
 */
export function etaFromRequiredAwakeMs(
  sentUtcMs: number,
  requiredAwakeMs: number,
  offsetMin: number,
  cfg: SleepConfig = DEFAULT_SLEEP
) {
  let t = sentUtcMs;
  let remaining = requiredAwakeMs;

  // safety against infinite loops
  let guard = 0;

  while (remaining > 0 && guard < 10000) {
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

/**
 * Pretty local text like "6:00 AM"
 */
export function sleepUntilLocalText(sleepUntilUtcMs: number, offsetMin: number) {
  const localMs = toLocalMs(sleepUntilUtcMs, offsetMin);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(localMs));
}

/**
 * If sleeping now, return the next wake time in UTC ms.
 * If awake now, return null.
 */
export function nextWakeUtcMs(nowUtcMs: number, offsetMin: number, cfg: SleepConfig = DEFAULT_SLEEP) {
  if (!isSleepingAt(nowUtcMs, offsetMin, cfg)) return null;

  let t = nowUtcMs;
  let guard = 0;

  // step forward until we are not sleeping
  while (guard < 1000) {
    guard++;
    const next = nextBoundaryUtcMs(t, offsetMin, cfg);
    t = next;

    // t is on a boundary; test just after it
    if (!isSleepingAt(t + 1, offsetMin, cfg)) return t;
  }

  return null;
}

/** Total sleep ms between [startUtcMs, endUtcMs) */
export function sleepMsBetween(
  startUtcMs: number,
  endUtcMs: number,
  offsetMin: number,
  cfg: SleepConfig = DEFAULT_SLEEP
) {
  const total = Math.max(0, endUtcMs - startUtcMs);
  const awake = awakeMsBetween(startUtcMs, endUtcMs, offsetMin, cfg);
  return Math.max(0, total - awake);
}

/**
 * Advance by "awake milliseconds" starting at startUtcMs (sleep pauses time).
 * If start is inside sleep, you can choose to jump to wake first.
 */
export function addAwakeMs(
  startUtcMs: number,
  addAwakeMs: number,
  offsetMin: number,
  cfg: SleepConfig = DEFAULT_SLEEP,
  opts?: { jumpIfSleeping?: boolean }
) {
  const jumpIfSleeping = opts?.jumpIfSleeping ?? true;

  let t = startUtcMs;
  if (jumpIfSleeping) {
    const wake = nextWakeUtcMs(t, offsetMin, cfg);
    if (wake != null) t = wake;
  }

  return etaFromRequiredAwakeMs(t, addAwakeMs, offsetMin, cfg);
}

/**
 * Progress 0..1 based on awake time (sleep pauses progress)
 */
export function awakeProgress01(
  sentUtcMs: number,
  etaUtcMs: number,
  nowUtcMs: number,
  offsetMin: number,
  cfg: SleepConfig = DEFAULT_SLEEP
) {
  if (etaUtcMs <= sentUtcMs) return 1;

  const totalAwake = awakeMsBetween(sentUtcMs, etaUtcMs, offsetMin, cfg);
  if (totalAwake <= 0) return 1;

  const elapsedAwake = awakeMsBetween(sentUtcMs, Math.min(nowUtcMs, etaUtcMs), offsetMin, cfg);
  return Math.max(0, Math.min(1, elapsedAwake / totalAwake));
}

/**
 * ✅ NEW HELPER (matches your "skip initial sleep window" policy):
 * If "send" occurs during sleep, return the wake time (UTC ms).
 * Status route can treat [sent..wake) as AWAKE for progress math,
 * without changing sent_at.
 */
export function initialSleepSkipUntilUtcMs(
  sentUtcMs: number,
  offsetMin: number,
  cfg: SleepConfig = DEFAULT_SLEEP
) {
  if (!Number.isFinite(sentUtcMs)) return null;
  if (!isSleepingAt(sentUtcMs, offsetMin, cfg)) return null;
  return nextWakeUtcMs(sentUtcMs, offsetMin, cfg);
}

/**
 * Back-compat helper.
 *
 * ⚠️ Old behavior: "push launch to next wake"
 * ✅ New behavior (your policy): DO NOT shift sent time.
 *
 * Keep this returning sentUtcMs so older callers don't secretly reintroduce the bug.
 */
export function launchUtcMs(sentUtcMs: number, _offsetMin: number, _cfg: SleepConfig = DEFAULT_SLEEP) {
  return sentUtcMs;
}