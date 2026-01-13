import type { TimelineItem } from "../_components/TimelineRail";

function dayLabelLocal(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildTimelineItems(args: {
  now: Date;

  // inputs from the page state
  letter: { sent_at: string; origin_name?: string | null };
  checkpointsByTime: any[];

  timelineFinal: boolean;
  uiDelivered: boolean;
  canceled: boolean;

  effectiveEtaISO: string;
}): TimelineItem[] {
  const { now, letter, checkpointsByTime, timelineFinal, uiDelivered, canceled, effectiveEtaISO } = args;
  const nowT = now.getTime();

  const safeSentAt = letter?.sent_at && String(letter.sent_at).trim() ? String(letter.sent_at) : null;

  const firstCp: any = (checkpointsByTime as any[])[0] || null;
  const firstCpAt: string | null = firstCp ? String(firstCp._atAdj || firstCp.at || "").trim() : null;

  const departedAt = safeSentAt || firstCpAt || new Date().toISOString();
  const departedName = letter?.origin_name ? `Departed · ${letter.origin_name}` : "Departed";

  const base: TimelineItem[] = [];

  base.push({
    key: "departed",
    name: departedName,
    at: departedAt,
    kind: "checkpoint",
  });

  for (const cp of checkpointsByTime as any[]) {
    const atISO = cp._atAdj || cp.at;
    const t = new Date(atISO).getTime();
    const isPastOrCurrent = Number.isFinite(t) ? t <= nowT : true;

    if (!timelineFinal && !isPastOrCurrent) continue;

    base.push({
      key: `${cp.kind || "checkpoint"}-${cp.id}`,
      name: cp.name,
      at: atISO,
      kind: cp.kind === "sleep" ? "sleep" : "checkpoint",
    });
  }

  if (uiDelivered && !canceled) {
    base.push({
      key: "delivered",
      name: "Delivered ✅",
      at: effectiveEtaISO || new Date().toISOString(),
      kind: "delivered",
    });
  }

  base.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const grouped: TimelineItem[] = [];
  let lastDay = "";

  for (const it of base) {
    const d = dayLabelLocal(it.at);
    if (d && d !== lastDay) {
      grouped.push({ key: `day-${d}`, name: d, at: it.at, kind: "day" });
      lastDay = d;
    }
    grouped.push(it);
  }

  return grouped;
}

export function pickCurrentTimelineKey(args: {
  items: TimelineItem[];
  now: Date;
  sleeping: boolean;
  uiDelivered: boolean;
  canceled: boolean;
}): string | null {
  const { items, now, sleeping, uiDelivered, canceled } = args;

  if (uiDelivered || canceled) return null;

  const realItems = items.filter((it) => it.kind !== "day");
  if (!realItems.length) return null;

  const nowT = now.getTime();

  if (sleeping) {
    let bestSleep: TimelineItem | null = null;
    let bestT = -Infinity;

    for (const it of realItems) {
      if (it.kind !== "sleep") continue;
      const t = new Date(it.at).getTime();
      if (t <= nowT && t >= bestT) {
        bestT = t;
        bestSleep = it;
      }
    }

    if (bestSleep) return bestSleep.key;
  }

  let bestKey: string | null = null;
  let bestT = -Infinity;

  for (const it of realItems) {
    const t = new Date(it.at).getTime();
    if (t <= nowT && t >= bestT) {
      bestT = t;
      bestKey = it.key;
    }
  }

  return bestKey ?? realItems[0].key;
}