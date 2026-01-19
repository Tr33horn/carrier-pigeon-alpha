"use client";

import { useEffect, useState } from "react";

export type TimelineKind = "checkpoint" | "sleep" | "day" | "delivered";

export type TimelineItem = {
  key: string;
  name: string;
  subtitle?: string;
  at: string; // ISO
  kind: TimelineKind;
};

function timeLabelLocal(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
}

export default function TimelineRail({
  items,
  now,
  currentKey,
  birdName,
  final,
}: {
  items: TimelineItem[];
  now: Date;
  currentKey: string | null;
  birdName: string;
  final: boolean;
}) {
  const [popped, setPopped] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updates: Record<string, boolean> = {};
    let changed = false;

    for (const it of items) {
      if (it.kind === "day") continue;
      const isPast = final || new Date(it.at).getTime() <= now.getTime();
      if (isPast && !popped[it.key]) {
        updates[it.key] = true;
        changed = true;
      }
    }

    if (changed) setPopped((prev) => ({ ...prev, ...updates }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now, final]);

  return (
    <div className="rail">
      <div className="railLine" />
      <div className="railList">
        {items.map((it) => {
          if (it.kind === "day") {
            return (
              <div key={it.key} style={{ margin: "10px 0 2px 0" }}>
                <div
                  className="metaPill faint"
                  style={{
                    display: "inline-flex",
                    background: "rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.08)",
                    padding: "6px 10px",
                    fontSize: 11,
                  }}
                >
                  {it.name}
                </div>
              </div>
            );
          }

          const isDeliveredRow = it.kind === "delivered";
          const isSleep = it.kind === "sleep";

          const isPast = final || isDeliveredRow || new Date(it.at).getTime() <= now.getTime();
          const shouldPop = popped[it.key] && isPast;
          const isCurrent = currentKey === it.key;

          return (
            <div key={it.key} className="railItem">
              <div className={`railNode ${isPast ? "past" : ""} ${shouldPop ? "pop" : ""}`}>
                <span
                  className="railDot"
                  style={
                    isSleep
                      ? {
                          background: isPast ? "rgba(88,80,236,0.95)" : "rgba(88,80,236,0.75)",
                          boxShadow: "0 0 0 7px rgba(88,80,236,0.12)",
                          color: "#fff",
                        }
                      : isDeliveredRow
                      ? {
                          background: "rgba(34,197,94,0.95)",
                          boxShadow: "0 0 0 7px rgba(34,197,94,0.12)",
                          color: "#fff",
                        }
                      : undefined
                  }
                >
                  {isSleep ? "🌙" : isDeliveredRow ? "✓" : isPast ? "✓" : ""}
                </span>
              </div>

              <div
                className={`railCard ${isPast ? "past" : ""} ${isCurrent ? "current" : ""}`}
                style={
                  isSleep
                    ? { background: "rgba(88,80,236,0.08)", borderColor: "rgba(88,80,236,0.35)" }
                    : isDeliveredRow
                    ? { background: "rgba(34,197,94,0.10)", borderColor: "rgba(34,197,94,0.40)" }
                    : undefined
                }
              >
                {isCurrent && (
                  <div className="pigeonTag livePulseRow" style={isSleep ? { background: "rgb(88,80,236)" } : undefined}>
                    <span className="livePulseDot" aria-hidden />
                    <span>{isSleep ? it.name : `${birdName} is here`}</span>
                  </div>
                )}

                <div className="railTitleRow">
                  <div className="railTitle">{it.name}</div>
                  <div className="railTime">{timeLabelLocal(it.at)}</div>
                </div>
                {it.subtitle ? <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{it.subtitle}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
