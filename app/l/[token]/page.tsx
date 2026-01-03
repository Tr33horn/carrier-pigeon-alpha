"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

type Letter = {
  id: string;
  public_token: string;
  from_name: string | null;
  to_name: string | null;
  subject: string | null;
  body: string | null;
  origin_name: string;
  origin_lat: number;
  origin_lon: number;
  dest_name: string;
  dest_lat: number;
  dest_lon: number;
  distance_km: number;
  speed_kmh: number;
  sent_at: string;
  eta_at: string;
};

type Checkpoint = {
  id: string;
  idx: number;
  name: string;
  at: string;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function progressFraction(sentISO: string, etaISO: string, now = new Date()) {
  const sent = new Date(sentISO).getTime();
  const eta = new Date(etaISO).getTime();
  const t = now.getTime();
  if (eta <= sent) return 1;
  return clamp01((t - sent) / (eta - sent));
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Delivered";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

function milestoneTimeISO(sentISO: string, etaISO: string, fraction: number) {
  const sent = new Date(sentISO).getTime();
  const eta = new Date(etaISO).getTime();
  if (!Number.isFinite(sent) || !Number.isFinite(eta) || eta <= sent) return etaISO;
  const t = sent + (eta - sent) * fraction;
  return new Date(t).toISOString();
}

/* ---------- tiny icon system (inline SVG) ---------- */
function Ico({
  name,
  size = 16,
}: {
  name:
    | "live"
    | "pin"
    | "clock"
    | "speed"
    | "distance"
    | "arrow"
    | "swap"
    | "check"
    | "mail"
    | "timeline";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    style: { display: "block" as const },
  };

  switch (name) {
    case "clock":
      return (
        <svg {...common}>
          <path
            d="M12 7v6l4 2"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path
            d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M12 10.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z"
            stroke="currentColor"
            strokeWidth="2.4"
          />
        </svg>
      );
    case "speed":
      return (
        <svg {...common}>
          <path
            d="M5 13a7 7 0 0 1 14 0"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M12 13l4.5-4.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 13h2M18 13h2"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "distance":
      return (
        <svg {...common}>
          <path
            d="M7 7h10M7 17h10"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M9 9l-2-2 2-2M15 15l2 2-2 2"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path
            d="M5 12h14"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "swap":
      return (
        <svg {...common}>
          <path
            d="M7 7h11l-2-2M17 17H6l2 2"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <path
            d="M4 7h16v10H4V7Z"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="m4 8 8 6 8-6"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "timeline":
      return (
        <svg {...common}>
          <path
            d="M7 6h10M7 12h10M7 18h10"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M4 6h.01M4 12h.01M4 18h.01"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "live":
    default:
      return (
        <svg {...common}>
          <path
            d="M4 12a8 8 0 0 1 16 0"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M8 12a4 4 0 0 1 8 0"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M12 12h.01"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

/* ---------- wax seal + delivery moment ---------- */
function WaxSealOverlay({ etaText, cracking }: { etaText: string; cracking?: boolean }) {
  return (
    <div className={cracking ? "seal crack" : "seal"} style={{ position: "relative" }}>
      <div className="sealCard">
        <div className="sealVeil" />
        <div className="sealRow">
          <div className="wax" aria-label="Wax seal" title="Sealed until delivery">
            <div className="waxInner">AH</div>
          </div>
          <div>
            <div className="sealTitle">Sealed until delivery</div>
            <div className="sealSub">Opens at {etaText}</div>
            <div className="sealHint">No peeking. The bird is watching.</div>
          </div>
        </div>
        <div className="sealNoise" />
      </div>
    </div>
  );
}

function ConfettiBurst({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} className="confetti-bit" />
      ))}
    </div>
  );
}

/* ---------- timeline rail component ---------- */
function RailTimeline({
  items,
  now,
}: {
  items: { key: string; name: string; at: string; kind: "checkpoint" | "milestone" }[];
  now: Date;
}) {
  const [popped, setPopped] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updates: Record<string, boolean> = {};
    let changed = false;

    for (const it of items) {
      const isPast = new Date(it.at).getTime() <= now.getTime();
      if (isPast && !popped[it.key]) {
        updates[it.key] = true;
        changed = true;
      }
    }

    if (changed) setPopped((prev) => ({ ...prev, ...updates }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now]);

  return (
    <div className="rail">
      <div className="railLine" />
      <div className="railList">
        {items.map((it) => {
          const isPast = new Date(it.at).getTime() <= now.getTime();
          const isMilestone = it.kind === "milestone";
          const shouldPop = popped[it.key] && isPast;

          return (
            <div key={it.key} className="railItem">
              <div
                className={`railNode ${isPast ? "past" : ""} ${isMilestone ? "milestone" : ""} ${
                  shouldPop ? "pop" : ""
                }`}
              >
                <span className="railDot" />
              </div>

              <div className={`railCard ${isPast ? "past" : ""} ${isMilestone ? "milestone" : ""}`}>
                <div className="railTitleRow">
                  <div className="railTitle">{it.name}</div>
                  <div className="railTime">{new Date(it.at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LetterStatusPage() {
  const params = useParams();
  const raw = (params as any)?.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  const [letter, setLetter] = useState<Letter | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [now, setNow] = useState(new Date());
  const [delivered, setDelivered] = useState(false);

  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const prevDelivered = useRef(false);
  const [revealStage, setRevealStage] = useState<"idle" | "crack" | "open">("idle");
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!token) return;

    let alive = true;

    const load = async () => {
      try {
        setError(null);
        const res = await fetch(`/api/letters/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          if (!alive) return;
          setError(data?.error ?? "Letter not found");
          return;
        }

        if (!alive) return;
        setLetter(data.letter as Letter);
        setDelivered(!!data.delivered);
        setCheckpoints((data.checkpoints ?? []) as Checkpoint[]);
        setLastFetchedAt(new Date());
      } catch (e: any) {
        console.error("LOAD ERROR:", e);
        if (!alive) return;
        setError(e?.message ?? String(e));
      }
    };

    load();

    const interval = setInterval(() => load(), 15000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!prevDelivered.current && delivered) {
      setRevealStage("crack");
      setConfetti(true);

      const t1 = setTimeout(() => setRevealStage("open"), 520);
      const t2 = setTimeout(() => setConfetti(false), 1400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    prevDelivered.current = delivered;
  }, [delivered]);

  const progress = useMemo(() => {
    if (!letter) return 0;
    return progressFraction(letter.sent_at, letter.eta_at, now);
  }, [letter, now]);

  const countdown = useMemo(() => {
    if (!letter) return "";
    const msLeft = new Date(letter.eta_at).getTime() - now.getTime();
    return formatCountdown(msLeft);
  }, [letter, now]);

  const currentCheckpoint = useMemo(() => {
    if (!checkpoints.length || !letter) return null;
    const t = now.getTime();
    let current: Checkpoint | null = null;
    for (const cp of checkpoints) {
      if (new Date(cp.at).getTime() <= t) current = cp;
    }
    return current ?? checkpoints[0];
  }, [checkpoints, letter, now]);

  const milestones = useMemo(() => {
    if (!letter) return [];
    const defs = [
      { pct: 25, frac: 0.25, label: "25% reached" },
      { pct: 50, frac: 0.5, label: "50% reached" },
      { pct: 75, frac: 0.75, label: "75% reached" },
    ];

    return defs.map((m) => {
      const atISO = milestoneTimeISO(letter.sent_at, letter.eta_at, m.frac);
      const isPast = now.getTime() >= new Date(atISO).getTime();
      return { ...m, atISO, isPast };
    });
  }, [letter, now]);

  const secondsSinceFetch = useMemo(() => {
    if (!lastFetchedAt) return null;
    return Math.max(0, Math.floor((now.getTime() - lastFetchedAt.getTime()) / 1000));
  }, [now, lastFetchedAt]);

  const currentlyOver = useMemo(() => {
    if (delivered) return "Delivered";
    return currentCheckpoint?.name ? currentCheckpoint.name : "somewhere over the U.S.";
  }, [delivered, currentCheckpoint]);

  const showLive = !delivered;

  const timelineItems = useMemo(() => {
    const cps = checkpoints.map((cp) => ({
      key: `cp-${cp.id}`,
      name: cp.name,
      at: cp.at,
      kind: "checkpoint" as const,
    }));
    const ms = milestones.map((m) => ({
      key: `ms-${m.pct}`,
      name: `🕊️ ${m.label}`,
      at: m.atISO,
      kind: "milestone" as const,
    }));
    return [...cps, ...ms].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [checkpoints, milestones]);

  if (error) {
    return (
      <main className="pageBg">
        <main className="wrap">
          <h1 className="h1">Flight Status</h1>
          <p className="err">❌ {error}</p>
        </main>
      </main>
    );
  }

  if (!letter) {
    return (
      <main className="pageBg">
        <main className="wrap">
          <h1 className="h1">Flight Status</h1>
          <p className="muted">Loading…</p>
        </main>
      </main>
    );
  }

  return (
    <main className="pageBg">
      <main className="wrap">
        {/* TOP ROUTE BANNER */}
        <section className="routeBanner">
          <div className="bannerTop">
            <div>
              <div className="kicker">Flight status</div>

              <div className="routeHeadline">
                {letter.origin_name} <span className="arrow">→</span> {letter.dest_name}
              </div>

              <div className="subRow">
                {showLive ? (
                  <>
                    <div className="liveStack">
                      <div className="liveWrap">
                        <span className="liveDot" />
                        <span className="liveText">LIVE</span>
                      </div>
                      <div className="liveSub">Last updated: {secondsSinceFetch ?? 0}s ago</div>
                    </div>

                    <div className="metaPill">
                      <span className="ico">
                        <Ico name="pin" />
                      </span>
                      <span>
                        Currently over: <strong>{currentlyOver}</strong>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="metaPill">
                    <span className="ico">
                      <Ico name="check" />
                    </span>
                    <span>
                      <strong>Delivered</strong> — the bird has clocked out.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="etaBox">
              <div className="kicker">ETA</div>
              <div className="etaTime">{new Date(letter.eta_at).toLocaleString()}</div>
              {!delivered && <div className="etaSub">T-minus {countdown}</div>}
            </div>
          </div>

          {/* stats row */}
          <div className="statsRow">
            <div className="stat">
              <span className="ico">
                <Ico name="distance" />
              </span>
              <div>
                <div className="statLabel">Distance</div>
                <div className="statValue">{letter.distance_km.toFixed(0)} km</div>
              </div>
            </div>

            <div className="stat">
              <span className="ico">
                <Ico name="speed" />
              </span>
              <div>
                <div className="statLabel">Speed</div>
                <div className="statValue">{letter.speed_kmh.toFixed(0)} km/h</div>
              </div>
            </div>

            <div className="stat">
              <span className="ico">
                <Ico name="timeline" />
              </span>
              <div>
                <div className="statLabel">Progress</div>
                <div className="statValue">{Math.round(progress * 100)}%</div>
              </div>
            </div>
          </div>
        </section>

        {/* LETTER directly under Flight Status */}
        <div className="card" style={{ marginTop: 14, position: "relative" }}>
          <ConfettiBurst show={confetti} />

          <div className="cardHead" style={{ marginBottom: 8 }}>
            <div>
              <div className="kicker">Letter</div>
              <div className="h2">
                From {letter.from_name || "Sender"} to {letter.to_name || "Recipient"}
              </div>
            </div>

            <div className="metaPill faint">
              <span className="ico">
                <Ico name="mail" />
              </span>
              <span>Sealed until delivery</span>
            </div>
          </div>

          <div className="soft">
            <div className="subject">{letter.subject || "(No subject)"}</div>

            <div style={{ position: "relative" }}>
              <div
                className={delivered && revealStage === "open" ? "bodyReveal" : ""}
                style={{ opacity: delivered ? 1 : 0 }}
              >
                <div className="body">{delivered ? (letter.body ?? "") : ""}</div>
              </div>

              {!delivered || revealStage !== "open" ? (
                <div style={{ position: delivered ? "absolute" : "relative", inset: 0 }}>
                  <WaxSealOverlay
                    etaText={new Date(letter.eta_at).toLocaleString()}
                    cracking={delivered && revealStage === "crack"}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="token">Token: {letter.public_token}</div>
        </div>

        {/* GRID */}
        <div className="grid">
          {/* MAP CARD */}
          <div className="card">
            <div className="kicker">Map</div>
            <div style={{ marginTop: 12 }}>
              <MapView
                origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
                dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
                progress={progress}
                tooltipText={`Currently over: ${currentlyOver}`}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="bar">
                <div className="barFill" style={{ width: `${Math.round(progress * 100)}%` }} />
                {[25, 50, 75].map((p) => (
                  <span key={p} className="barTick" style={{ left: `${p}%` }} />
                ))}
              </div>
              <div className="barMeta">
                <div className="mutedStrong">{Math.round(progress * 100)}%</div>
                <div className="muted">{currentCheckpoint ? `Current: ${currentCheckpoint.name}` : ""}</div>
              </div>

              <div className="chips">
                {milestones.map((m) => (
                  <div key={m.pct} className={`chip ${m.isPast ? "on" : ""}`}>
                    <span className="chipDot">{m.isPast ? "●" : "○"}</span>
                    <span className="chipLabel">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TIMELINE CARD */}
          <div className="card">
            <div className="cardHead">
              <div>
                <div className="kicker">Timeline</div>
                <div className="h2">Flight log</div>
              </div>
              <div className="pillBtn subtle" title="Auto refresh">
                <span className="ico">
                  <Ico name="live" />
                </span>
                {delivered ? "Final" : "Auto"}
              </div>
            </div>

            <RailTimeline items={timelineItems} now={now} />
          </div>
        </div>
      </main>

      {/* ---------- global styles ---------- */}
      <style jsx global>{`
        :root {
          --bg: #f6f6f4;
          --card: #ffffff;
          --soft: #f0f0ed;
          --ink: #121212;

          /* Alpinhound blue wash */
          --alp-blue: #cceffd;
          --alp-blue-30: rgba(204, 239, 253, 0.3);
          --alp-blue-18: rgba(204, 239, 253, 0.18);
          --alp-blue-12: rgba(204, 239, 253, 0.12);

          /* LIVE pulse green */
          --live-green: #16a34a;
          --live-green-30: rgba(22, 163, 74, 0.30);
          --live-green-55: rgba(22, 163, 74, 0.55);

          --border: rgba(0, 0, 0, 0.08);
          --shadow-lg: 0 12px 28px rgba(0, 0, 0, 0.10);
          --shadow-md: 0 8px 18px rgba(0, 0, 0, 0.10);
        }

        body {
          color: var(--ink);
          background: var(--bg);
        }

        .pageBg {
          min-height: 100vh;
          background: var(--bg);
          position: relative;
        }

        .pageBg::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.06;
          mix-blend-mode: multiply;
          background-image:
            radial-gradient(circle at 20% 30%, rgba(0,0,0,0.10) 0.5px, transparent 0.6px),
            radial-gradient(circle at 80% 70%, rgba(0,0,0,0.08) 0.5px, transparent 0.6px),
            radial-gradient(circle at 50% 50%, rgba(0,0,0,0.07) 0.5px, transparent 0.6px);
          background-size: 6px 6px;
        }

        .wrap {
          padding: 24px;
          max-width: 1050px;
          margin: 0 auto;
          font-family: "Bricolage Grotesque", system-ui, -apple-system, Segoe UI, Roboto, Arial;
        }

        .h1 {
          font-size: 34px;
          font-weight: 900;
          letter-spacing: -0.03em;
          margin: 0;
        }

        .h2 {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.02em;
          margin-top: 4px;
        }

        .kicker {
          font-size: 12px;
          font-weight: 900;
          opacity: 0.6;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .muted {
          opacity: 0.65;
          font-weight: 750;
          font-size: 12px;
        }

        .mutedStrong {
          opacity: 0.75;
          font-weight: 900;
          font-size: 12px;
        }

        .err {
          color: #d92d20;
          margin-top: 12px;
          font-weight: 900;
        }

        .card {
          background: var(--card);
          border-radius: 20px;
          padding: 16px;
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border);
        }

        .soft {
          background: var(--soft);
          border-radius: 18px;
          padding: 14px;
          border: 1px solid rgba(0, 0, 0, 0.06);
        }

        .routeBanner {
          border-radius: 24px;
          padding: 18px;
          background: #ffffff;
          border: 1px solid var(--border);
          box-shadow: var(--shadow-lg);
          position: relative;
          overflow: hidden;
        }

        .routeBanner::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, var(--alp-blue-30), rgba(204,239,253,0) 58%),
            linear-gradient(0deg, rgba(0,0,0,0.03), rgba(0,0,0,0));
          pointer-events: none;
        }

        .bannerTop {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          position: relative;
          z-index: 1;
        }

        .routeHeadline {
          font-size: 34px;
          font-weight: 900;
          letter-spacing: -0.035em;
          margin-top: 8px;
          line-height: 1.05;
        }

        .arrow {
          opacity: 0.35;
          margin: 0 8px;
        }

        .subRow {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: flex-start;
        }

        .etaBox {
          padding: 12px 14px;
          border-radius: 18px;
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.06);
          min-width: 280px;
        }

        .etaTime {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: -0.01em;
          margin-top: 4px;
          line-height: 1.2;
        }

        .etaSub {
          font-size: 12px;
          font-weight: 900;
          opacity: 0.7;
          margin-top: 2px;
        }

        /* ---------- pills / buttons ---------- */
        .ico {
          display: inline-grid;
          place-items: center;
          width: 18px;
          height: 18px;
        }

        .pillBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 10px 14px;
          font-weight: 900;
          border: 1px solid rgba(0, 0, 0, 0.14);
          background: #fff;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
          user-select: none;
        }
        .pillBtn.subtle {
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.10);
          box-shadow: none;
        }

        .metaPill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 850;
          font-size: 12px;
          background: rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.10);
        }
        .metaPill.faint {
          opacity: 0.75;
        }

        /* ---------- LIVE stack: black pill + green pulse dot ---------- */
        .liveStack {
          display: grid;
          gap: 6px;
        }

        .liveSub {
          font-size: 12px;
          font-weight: 850;
          opacity: 0.65;
          padding-left: 10px;
        }

        .liveWrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;

          /* KEEP PILL BLACK */
          background: var(--ink);
          border: 1px solid rgba(0, 0, 0, 0.20);
          color: #fff;

          font-weight: 900;
          font-size: 12px;
        }

        .liveText {
          letter-spacing: 0.10em;
        }

        .liveDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;

          /* DOT GREEN */
          background: var(--live-green);

          /* Make the pulse obvious even on black pill */
          box-shadow: 0 0 0 0 var(--live-green-55);
          animation: livePulseGreen 1.15s ease-out infinite;
          display: inline-block;
        }

        @keyframes livePulseGreen {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 var(--live-green-55);
          }
          70% {
            transform: scale(1.08);
            box-shadow: 0 0 0 10px rgba(22, 163, 74, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
          }
        }

        /* ---------- stats ---------- */
        .statsRow {
          margin-top: 14px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          position: relative;
          z-index: 1;
        }

        .stat {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 12px 12px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(0, 0, 0, 0.06);
        }

        .statLabel {
          font-size: 11px;
          font-weight: 900;
          opacity: 0.6;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .statValue {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: -0.01em;
          margin-top: 2px;
        }

        /* ---------- grid ---------- */
        .grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 14px;
          margin-top: 14px;
        }

        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
          .etaBox {
            min-width: unset;
            width: 100%;
          }
          .bannerTop {
            flex-direction: column;
          }
          .statsRow {
            grid-template-columns: 1fr;
          }
        }

        .cardHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        /* ---------- progress bar ---------- */
        .bar {
          position: relative;
          height: 12px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.10);
          overflow: hidden;
        }

        .barFill {
          height: 100%;
          background: var(--ink);
          transition: width 0.4s ease;
        }

        .barTick {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(0, 0, 0, 0.16);
          transform: translateX(-1px);
        }

        .barMeta {
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
        }

        .chips {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chip {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.10);
          background: rgba(255, 255, 255, 0.70);
          font-size: 12px;
          font-weight: 900;
          opacity: 0.55;
        }

        .chip.on {
          opacity: 1;
          border-color: rgba(0, 0, 0, 0.12);
          background: var(--alp-blue-30);
        }

        .chipDot {
          font-weight: 900;
        }

        .chipLabel {
          letter-spacing: -0.01em;
        }

        /* ---------- rail timeline ---------- */
        .rail {
          position: relative;
          margin-top: 14px;
          padding-left: 16px;
        }

        .railLine {
          position: absolute;
          left: 10px;
          top: 4px;
          bottom: 4px;
          width: 2px;
          background: rgba(0, 0, 0, 0.10);
          border-radius: 999px;
        }

        .railList {
          display: grid;
          gap: 10px;
        }

        .railItem {
          display: grid;
          grid-template-columns: 24px 1fr;
          gap: 10px;
          align-items: stretch;
        }

        .railNode {
          position: relative;
          display: grid;
          place-items: center;
          width: 24px;
        }

        .railDot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.22);
          box-shadow: 0 0 0 6px rgba(0, 0, 0, 0.04);
        }

        .railNode.past .railDot {
          background: var(--ink);
          box-shadow: 0 0 0 6px rgba(0, 0, 0, 0.06);
        }

        .railNode.milestone .railDot {
          background: var(--ink);
          box-shadow: 0 0 0 6px var(--alp-blue-30);
        }

        .railNode.pop .railDot {
          animation: pop 420ms ease-out both;
        }
        @keyframes pop {
          0% { transform: scale(0.75); }
          55% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }

        .railCard {
          border-radius: 16px;
          padding: 12px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(0, 0, 0, 0.035);
        }

        .railCard.past {
          background: rgba(255, 255, 255, 0.85);
          box-shadow: 0 10px 20px rgba(0,0,0,0.06);
        }

        .railCard.milestone {
          background: var(--alp-blue-30);
          border-color: rgba(0, 0, 0, 0.08);
        }

        .railTitleRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
        }

        .railTitle {
          font-weight: 900;
          letter-spacing: -0.01em;
          font-size: 13px;
        }

        .railTime {
          font-size: 12px;
          font-weight: 850;
          opacity: 0.65;
          white-space: nowrap;
        }

        /* ---------- letter ---------- */
        .subject {
          font-weight: 900;
          margin-bottom: 10px;
          font-size: 14px;
          letter-spacing: -0.01em;
        }

        .body {
          white-space: pre-wrap;
          line-height: 1.55;
          font-size: 14px;
          font-weight: 650;
        }

        .token {
          margin-top: 14px;
          opacity: 0.55;
          font-size: 11px;
          font-weight: 900;
        }

        /* ---------- seal ---------- */
        .sealCard {
          position: relative;
          border-radius: 18px;
          padding: 18px;
          background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.40));
          overflow: hidden;
          box-shadow: var(--shadow-md);
          border: 1px solid rgba(0,0,0,0.06);
        }

        .sealVeil {
          position: absolute;
          inset: 0;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          background: rgba(255,255,255,0.35);
        }

        .sealRow {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .wax {
          width: 64px;
          height: 64px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%),
            radial-gradient(circle at 70% 75%, rgba(0,0,0,0.20), rgba(0,0,0,0) 45%),
            linear-gradient(145deg, #d92d20, #8B1A12);
          box-shadow: 0 10px 24px rgba(0,0,0,0.18), inset 0 2px 10px rgba(255,255,255,0.22);
          border: 1px solid rgba(255,255,255,0.55);
          display: grid;
          place-items: center;
          transform: rotate(-8deg);
        }

        .waxInner {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px dashed rgba(255,255,255,0.70);
          display: grid;
          place-items: center;
          font-weight: 900;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.96);
          font-size: 14px;
          text-transform: uppercase;
        }

        .sealTitle {
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 4px;
        }

        .sealSub {
          font-size: 12px;
          opacity: 0.75;
          font-weight: 850;
        }

        .sealHint {
          font-size: 12px;
          opacity: 0.6;
          margin-top: 6px;
          font-weight: 850;
        }

        .sealNoise {
          position: absolute;
          inset: 0;
          opacity: 0.08;
          background-image: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.10) 0px,
            rgba(0, 0, 0, 0.10) 1px,
            rgba(0, 0, 0, 0) 2px,
            rgba(0, 0, 0, 0) 6px
          );
          mix-blend-mode: multiply;
          pointer-events: none;
        }

        .seal.crack {
          animation: crack 520ms ease-out forwards;
          transform-origin: 50% 60%;
        }

        @keyframes crack {
          0% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
            filter: none;
          }
          55% {
            transform: scale(1.02) rotate(-1deg);
            opacity: 1;
            filter: brightness(1.02);
          }
          100% {
            transform: scale(0.98) rotate(3deg) translateY(10px);
            opacity: 0;
            filter: blur(2px);
          }
        }

        .bodyReveal {
          animation: reveal 420ms ease-out forwards;
        }

        @keyframes reveal {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ---------- confetti ---------- */
        .confetti {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: 20px;
        }

        .confetti-bit {
          position: absolute;
          top: -10px;
          left: 50%;
          width: 10px;
          height: 6px;
          border-radius: 3px;
          background: rgba(18, 18, 18, 0.9);
          transform: translateX(-50%);
          animation: confettiFall 1100ms ease-out forwards;
        }

        .confetti-bit:nth-child(3n) {
          background: rgba(204, 239, 253, 0.95);
          border: 1px solid rgba(0,0,0,0.08);
        }

        .confetti-bit:nth-child(4n) {
          background: rgba(0, 0, 0, 0.35);
        }

        .confetti-bit:nth-child(1) { left: 10%; animation-delay: 0ms; }
        .confetti-bit:nth-child(2) { left: 18%; animation-delay: 40ms; }
        .confetti-bit:nth-child(3) { left: 28%; animation-delay: 80ms; }
        .confetti-bit:nth-child(4) { left: 36%; animation-delay: 20ms; }
        .confetti-bit:nth-child(5) { left: 44%; animation-delay: 120ms; }
        .confetti-bit:nth-child(6) { left: 52%; animation-delay: 60ms; }
        .confetti-bit:nth-child(7) { left: 60%; animation-delay: 140ms; }
        .confetti-bit:nth-child(8) { left: 68%; animation-delay: 30ms; }
        .confetti-bit:nth-child(9) { left: 76%; animation-delay: 90ms; }
        .confetti-bit:nth-child(10){ left: 84%; animation-delay: 10ms; }
        .confetti-bit:nth-child(11){ left: 92%; animation-delay: 110ms; }
        .confetti-bit:nth-child(12){ left: 14%; animation-delay: 150ms; }
        .confetti-bit:nth-child(13){ left: 24%; animation-delay: 170ms; }
        .confetti-bit:nth-child(14){ left: 34%; animation-delay: 190ms; }
        .confetti-bit:nth-child(15){ left: 54%; animation-delay: 210ms; }
        .confetti-bit:nth-child(16){ left: 64%; animation-delay: 230ms; }
        .confetti-bit:nth-child(17){ left: 74%; animation-delay: 250ms; }
        .confetti-bit:nth-child(18){ left: 88%; animation-delay: 270ms; }

        @keyframes confettiFall {
          0% {
            transform: translateX(-50%) translateY(0) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 1; }
          100% {
            transform: translateX(-50%) translateY(220px) rotate(160deg);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}