import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { checkpointGeoText } from "../../../lib/geo";

// ✅ Shared sleep logic (single source of truth)
import {
  offsetMinutesFromLon,
  isSleepingAt,
  awakeMsBetween,
  etaFromRequiredAwakeMs,
  initialSleepSkipUntilUtcMs,
  type SleepConfig,
} from "@/app/lib/flightSleep";

// ✅ Single source of truth for bird rules
import { BIRD_RULES, normalizeBird, type BirdType } from "@/app/lib/birds";

let warnedMissingSleepColumns = false;

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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* -------------------------------------------------
   Query helpers
------------------------------------------------- */

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

/* -------------------------------------------------
   Skip-initial-sleep-window helpers (match status API)
------------------------------------------------- */

/**
 * Treat [sent..skipUntil) as awake if the send happened during the bird's sleep window.
 * This matches your /api/letters/[token] behavior.
 */
function computeInitialSleepSkip(sentMs: number, offsetMin: number, sleepCfg: SleepConfig, ignoresSleep: boolean) {
  if (ignoresSleep) return { skipUntilMs: null as number | null };

  const wake = initialSleepSkipUntilUtcMs(sentMs, offsetMin, sleepCfg);
  if (!wake || !Number.isFinite(wake) || wake <= sentMs) return { skipUntilMs: null };

  return { skipUntilMs: wake };
}

function awakeMsBetweenWithSkip(
  startMs: number,
  endMs: number,
  offsetMin: number,
  sleepCfg: SleepConfig,
  skipUntilMs: number | null,
  ignoresSleep: boolean
) {
  if (endMs <= startMs) return 0;

  if (ignoresSleep) return endMs - startMs;

  // If we’re in the initial skip window, count it as awake time.
  if (skipUntilMs && startMs < skipUntilMs) {
    const a = startMs;
    const b = Math.min(endMs, skipUntilMs);
    const awakeInSkip = Math.max(0, b - a);

    if (endMs <= skipUntilMs) return awakeInSkip;

    return awakeInSkip + awakeMsBetween(skipUntilMs, endMs, offsetMin, sleepCfg);
  }

  return awakeMsBetween(startMs, endMs, offsetMin, sleepCfg);
}

function etaFromRequiredAwakeMsWithSkip(
  sentMs: number,
  requiredAwakeMs: number,
  offsetMin: number,
  sleepCfg: SleepConfig,
  skipUntilMs: number | null,
  ignoresSleep: boolean
) {
  if (requiredAwakeMs <= 0) return sentMs;
  if (ignoresSleep) return sentMs + requiredAwakeMs;

  // Spend the “initial awake budget” first (skip window), then run sleep-aware ETA from skipUntil.
  if (skipUntilMs && sentMs < skipUntilMs) {
    const initialAwakeBudget = skipUntilMs - sentMs;
    if (requiredAwakeMs <= initialAwakeBudget) return sentMs + requiredAwakeMs;

    const remaining = requiredAwakeMs - initialAwakeBudget;
    return etaFromRequiredAwakeMs(skipUntilMs, remaining, offsetMin, sleepCfg);
  }

  return etaFromRequiredAwakeMs(sentMs, requiredAwakeMs, offsetMin, sleepCfg);
}

/* -------------------------------------------------
   View model computation (dashboard rows)
------------------------------------------------- */

function computeViewModel(l: RawLetter, cps: any[], realNowMs: number, direction: Direction) {
  const bird: BirdType = normalizeBird(l.bird);
  const rule = BIRD_RULES[bird];

  const sentMs = safeParseMs(l.sent_at);
  const etaStoredMs = safeParseMs(l.eta_at);

  const canceledAtMs = safeParseMs(l.canceled_at);
  const canceled = canceledAtMs != null && Number.isFinite(canceledAtMs);

  // ✅ If canceled, freeze calculations at cancel time (not "now")
  const calcNowMs = canceled ? Math.min(realNowMs, canceledAtMs!) : realNowMs;

  // ✅ Use MIDPOINT lon like status/send do (consistency > “perfection”)
  const oLon = Number(l.origin_lon);
  const dLon = Number(l.dest_lon);
  const hasOLon = Number.isFinite(oLon);
  const hasDLon = Number.isFinite(dLon);
  const midLon = hasOLon && hasDLon ? (oLon + dLon) / 2 : hasOLon ? oLon : hasDLon ? dLon : 0;
  const storedOffsetMin = Number(l.sleep_offset_min);
  const offsetMin = Number.isFinite(storedOffsetMin)
    ? clamp(storedOffsetMin, -12 * 60, 14 * 60)
    : offsetMinutesFromLon(midLon);

  const distanceKm = Number(l.distance_km);
  const hasDistance = Number.isFinite(distanceKm) && distanceKm > 0;

  // ✅ Speed and inefficiency come from birds.ts (NOT DB)
  const speedKmhEffective = Number(rule.speedKmh);
  const ineff = Number(rule.inefficiency);

  const hasFlightInputs = sentMs != null && hasDistance && Number.isFinite(speedKmhEffective) && speedKmhEffective > 0;

  const requiredAwakeMs = hasFlightInputs ? (distanceKm / speedKmhEffective) * ineff * 3600_000 : 0;

  const sleepStartStored = Number(l.sleep_start_hour);
  const sleepEndStored = Number(l.sleep_end_hour);
  const sleepCfg =
    Number.isFinite(sleepStartStored) && Number.isFinite(sleepEndStored)
      ? {
          sleepStartHour: clamp(sleepStartStored, 0, 23),
          sleepEndHour: clamp(sleepEndStored, 0, 23),
        }
      : rule.sleepCfg;

  // ✅ Skip-initial-sleep-window policy (same as status API)
  const { skipUntilMs } =
    sentMs != null && Number.isFinite(sentMs)
      ? computeInitialSleepSkip(sentMs, offsetMin, sleepCfg, rule.ignoresSleep)
      : { skipUntilMs: null as number | null };

  // ✅ Compute adjusted ETA if we safely can; otherwise fall back to stored eta_at.
  let etaAdjustedMs: number | null = null;

  if (sentMs != null && requiredAwakeMs > 0) {
    etaAdjustedMs = etaFromRequiredAwakeMsWithSkip(sentMs, requiredAwakeMs, offsetMin, sleepCfg, skipUntilMs, rule.ignoresSleep);
  } else if (etaStoredMs != null) {
    etaAdjustedMs = etaStoredMs;
  }

  // ✅ Last-resort fallback: "deliver now" if we have neither.
  if (etaAdjustedMs == null) etaAdjustedMs = calcNowMs;

  // ✅ Delivered is false if canceled (even if time would have passed)
  const delivered = canceled ? false : calcNowMs >= etaAdjustedMs;

  // ✅ sleeping flag for dashboard (never sleeping if canceled/delivered)
  // ✅ if we’re inside the initial skip window, force sleeping=false
  const inSkip = !!(skipUntilMs && calcNowMs < skipUntilMs);
  const sleeping =
    canceled || delivered
      ? false
      : rule.ignoresSleep
      ? false
      : inSkip
      ? false
      : isSleepingAt(calcNowMs, offsetMin, sleepCfg);

  // ✅ progress (sleep-aware + skip window)
  let traveledAwakeMs = 0;
  if (sentMs != null && calcNowMs > sentMs && requiredAwakeMs > 0) {
    traveledAwakeMs = awakeMsBetweenWithSkip(
      sentMs,
      Math.min(calcNowMs, etaAdjustedMs),
      offsetMin,
      sleepCfg,
      skipUntilMs,
      rule.ignoresSleep
    );
  }

  const progress = requiredAwakeMs > 0 ? clamp(traveledAwakeMs / requiredAwakeMs, 0, 1) : delivered ? 1 : 0;

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
    : `${formatUTC(etaAdjustedISO)} UTC`;

  // ✅ Optional, but handy for UI consistency
  const current_speed_kmh = canceled || delivered || sleeping ? 0 : speedKmhEffective;

  return {
    ...l,
    direction,

    // ✅ ensure bird is normalized for UI
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

    // ✅ same key used by status API (optional)
    current_speed_kmh,

    badges_count: 0,
  };
}

/* -------------------------------------------------
   Route handler
------------------------------------------------- */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  const qRaw = (searchParams.get("q") || "").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const baseSelect = `
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
      opened_at,
      delivered_notified_at,
      sender_receipt_sent_at,
      distance_km,
      archived_at,
      canceled_at,
      bird,
      recipient_archived_at
    `;
  const sleepSelect = `${baseSelect}, sleep_offset_min, sleep_start_hour, sleep_end_hour`;
  const missingSleepColumns = (err: any) =>
    !!err && (err.code === "42703" || /sleep_(offset|min|start|end)/i.test(err.message || ""));

  // --- Sent letters ---
  let sentData: any[] | null = null;
  let sentErr: any = null;
  ({ data: sentData, error: sentErr } = await supabaseServer
    .from("letters")
    .select(sleepSelect)
    .eq("from_email", email)
    .or("archived_at.is.null,canceled_at.not.is.null")
    .order("sent_at", { ascending: false })
    .limit(50));

  if (sentErr && missingSleepColumns(sentErr)) {
    if (!warnedMissingSleepColumns) {
      console.warn("letters.sleep_* columns missing (api/dashboard/letters); falling back to legacy select.");
      warnedMissingSleepColumns = true;
    }
    ({ data: sentData, error: sentErr } = await supabaseServer
      .from("letters")
      .select(baseSelect)
      .eq("from_email", email)
      .or("archived_at.is.null,canceled_at.not.is.null")
      .order("sent_at", { ascending: false })
      .limit(50));
  }

  if (sentErr) {
    return NextResponse.json({ error: sentErr.message }, { status: 500 });
  }

  // --- Incoming letters ---
  let incomingData: any[] | null = null;
  let incomingErr: any = null;
  ({ data: incomingData, error: incomingErr } = await supabaseServer
    .from("letters")
    .select(sleepSelect)
    .eq("to_email", email)
    .is("recipient_archived_at", null)
    .order("sent_at", { ascending: false })
    .limit(50));

  if (incomingErr && missingSleepColumns(incomingErr)) {
    if (!warnedMissingSleepColumns) {
      console.warn("letters.sleep_* columns missing (api/dashboard/letters); falling back to legacy select.");
      warnedMissingSleepColumns = true;
    }
    ({ data: incomingData, error: incomingErr } = await supabaseServer
      .from("letters")
      .select(baseSelect)
      .eq("to_email", email)
      .is("recipient_archived_at", null)
      .order("sent_at", { ascending: false })
      .limit(50));
  }

  if (incomingErr) {
    return NextResponse.json({ error: incomingErr.message }, { status: 500 });
  }

  let sentLetters = (sentData ?? []) as RawLetter[];
  let incomingLetters = (incomingData ?? []) as RawLetter[];

  // Server-side search filter
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
  let sentOut = sentLetters.map((l: any) => computeViewModel(l, checkpointsByLetter.get(l.id) ?? [], realNowMs, "sent"));
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

  // Backward compatible response
  return NextResponse.json({
    letters: sentOut,
    sentLetters: sentOut,
    incomingLetters: incomingOut,
  });
}
