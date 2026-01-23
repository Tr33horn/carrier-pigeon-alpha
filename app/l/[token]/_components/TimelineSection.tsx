"use client";

import { useEffect, useMemo, useState } from "react";

import TimelineRail, { type TimelineItem } from "./TimelineRail";
import { buildTimelineItems, pickCurrentTimelineKey } from "../_lib/letterStatusTimeline";

type LetterInput = {
  sent_at: string;
  origin_name?: string | null;
};

export default function TimelineSection({
  letter,
  checkpoints,
  delivered,
  canceled,
  sleeping,
  effectiveEtaISO,
  birdName,
  nowISO,
}: {
  letter: LetterInput;
  checkpoints: any[];
  delivered: boolean;
  canceled: boolean;
  sleeping: boolean;
  effectiveEtaISO: string;
  birdName: string;
  nowISO?: string;
}) {
  const [now, setNow] = useState<Date>(() => (nowISO ? new Date(nowISO) : new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timelineFinal = delivered || canceled;

  const items = useMemo<TimelineItem[]>(
    () =>
      buildTimelineItems({
        now,
        letter,
        checkpointsByTime: checkpoints,
        timelineFinal,
        uiDelivered: delivered,
        canceled,
        effectiveEtaISO,
      }),
    [now, letter, checkpoints, timelineFinal, delivered, canceled, effectiveEtaISO]
  );

  const currentKey = useMemo(
    () =>
      pickCurrentTimelineKey({
        items,
        now,
        sleeping,
        uiDelivered: delivered,
        canceled,
      }),
    [items, now, sleeping, delivered, canceled]
  );

  return <TimelineRail items={items} now={now} currentKey={currentKey} birdName={birdName} final={timelineFinal} />;
}
