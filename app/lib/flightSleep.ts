// app/lib/flightSleep.ts

export type SleepConfig = {
  sleepStartHour: number; // 0-23 local
  sleepEndHour: number;   // 0-23 local
  // Example: 22 -> 6 means 10pm to 6am (wraps midnight)
};

const DEFAULT_SLEEP: SleepConfig = { sleepStartHour: 22, sleepEndHour: 6 };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Very lightweight "timezone" for US: infer a fixed UTC offset from longitude.
 * -120 lon ~ UTC-8, -75 ~ UTC-5, etc.
 * This is a heuristic (good enough for vibe + consistency).
 */
export function offsetMinutesFromLon(lon: number) {
  if (!Number.isFinite(lon)) return 0;
  const hours = Math.round(lon / 15); // -120/15 = -8
  return clamp(hours * 60, -600, -240); // clamp to typical US offsets (UTC-10..UTC-4)
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
  const mkLocal = (hh: number, mm = 0) =>
    Date.UTC(y, m, day, hh, mm, 0, 0);

  const sleepStartLocal = mkLocal(cfg.sleepStartHour);
  const sleepEndLocal = mkLocal(cfg.sleepEndHour);

  // Because sleep may wrap midnight
  // If sleepStartHour > sleepEndHour => window crosses midnight.
  const wraps = cfg.sleepStartHour > cfg.sleepEndHour;

  // Candidate boundaries today (and possibly tomorrow for end if wraps)
  const candidatesLocal: number[] = [];

  // Always consider end-of-day as a boundary so we can move forward safely
  candidatesLocal.push(Date.UTC(y, m, day + 1, 0, 0, 0, 0));

  candidatesLocal.push(sleepStartLocal);

  if (wraps) {
    // sleep end is next day
    candidatesLocal.push(Date.UTC(y, m, day + 1, cfg.sleepEndHour, 0, 0, 0));
  } else {
    candidatesLocal.push(sleepEndLocal);
  }

  // Convert candidates to UTC and pick the soonest > utcMs
  const candidatesUtc = candidatesLocal
    .map((lm) => toUtcMs(lm, offsetMin))
    .filter((t) => t > utcMs + 1); // strictly in the future

  if (!candidatesUtc.length) {
    // fallback: +1 hour
    return utcMs + 3600_000;
  }

  return Math.min(...candidatesUtc);
}

export function isSleepingAt(utcMs: number, offsetMin: number, cfg: SleepConfig = DEFAULT_SLEEP) {
  const localMs = toLocalMs(utcMs, offsetMin);
  const d = new Date(localMs);
  const h = d.getUTCHours(); // because localMs already shifted

  const wraps = cfg.sleepStartHour > cfg.sleepEndHour;
  if (!wraps) {
    return h >= cfg.sleepStartHour && h < cfg.sleepEndHour;
  }
  // wraps midnight, e.g. 22..6
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
    if (!sleeping) awake += (next - t);
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
 * Pretty local text like "Sleeps until 6:00 AM"
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
export function nextWakeUtcMs(
  nowUtcMs: number,
  offsetMin: number,
  cfg: SleepConfig = DEFAULT_SLEEP
) {
  if (!isSleepingAt(nowUtcMs, offsetMin, cfg)) return null;

  // step forward until we are not sleeping
  let t = nowUtcMs;
  let guard = 0;
  while (guard < 1000) {
    guard++;
    const next = nextBoundaryUtcMs(t, offsetMin, cfg);
    t = next;
    if (!isSleepingAt(t + 1, offsetMin, cfg)) return t;
  }
  return null;
}