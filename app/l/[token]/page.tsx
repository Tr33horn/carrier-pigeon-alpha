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
  body: string | null; // body is null until delivered
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

/* ---------- Wax Seal ---------- */
function WaxSealOverlay({ etaText, cracking }: { etaText: string; cracking?: boolean }) {
  return (
    <div className={cracking ? "seal crack" : "seal"} style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          borderRadius: 18,
          padding: 18,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.40))",
          overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            background: "rgba(255,255,255,0.35)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "999px",
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%)," +
                "radial-gradient(circle at 70% 75%, rgba(0,0,0,0.20), rgba(0,0,0,0) 45%)," +
                "linear-gradient(145deg, var(--brand-red), #8B1A12)",
              boxShadow:
                "0 10px 24px rgba(0,0,0,0.18), inset 0 2px 10px rgba(255,255,255,0.22)",
              border: "1px solid rgba(255,255,255,0.55)",
              display: "grid",
              placeItems: "center",
              transform: "rotate(-8deg)",
            }}
            aria-label="Wax seal"
            title="Sealed until delivery"
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "999px",
                border: "1px dashed rgba(255,255,255,0.70)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                letterSpacing: 1,
                color: "rgba(255,255,255,0.96)",
                fontSize: 14,
                textTransform: "uppercase",
              }}
            >
              AH
            </div>
          </div>

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>
              Sealed until delivery
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Opens at {etaText}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              No peeking. The bird is watching.
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0.10) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

/* ---------- Confetti ---------- */
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

    // feels “live” while in flight
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

  const page = {
    padding: 24,
    fontFamily: `"Bricolage Grotesque", system-ui, -apple-system, Segoe UI, Roboto, Arial`,
    maxWidth: 980,
    margin: "0 auto",
    color: "var(--ink)",
  } as const;

  const card = {
    background: "var(--card)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "var(--shadow-lg)",
    border: "1px solid rgba(0,0,0,0.06)",
  } as const;

  const soft = {
    background: "var(--soft)",
    borderRadius: 18,
    padding: 16,
    border: "1px solid rgba(0,0,0,0.06)",
  } as const;

  if (error) {
    return (
      <main className="pageBg">
        <main style={page}>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            Flight Status
          </h1>
          <p style={{ color: "var(--brand-red)", marginTop: 12, fontWeight: 800 }}>
            ❌ {error}
          </p>
        </main>
      </main>
    );
  }

  if (!letter) {
    return (
      <main className="pageBg">
        <main style={page}>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            Flight Status
          </h1>
          <p style={{ marginTop: 12, opacity: 0.7, fontWeight: 700 }}>Loading…</p>
        </main>
      </main>
    );
  }

  return (
    <main className="pageBg">
      <main style={page}>
        {/* TOP BANNER BLOCK (Route) */}
        <section className="routeBanner">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
            <div>
              <div className="kicker">Flight status</div>

              <div className="routeHeadline">
                {letter.origin_name} <span className="arrow">→</span> {letter.dest_name}
              </div>

              <div className="subRow">
                {showLive ? (
                  <>
                    <div className="liveWrap">
                      <span className="liveDot" />
                      <span className="liveText">LIVE</span>
                    </div>
                    <div className="metaText">
                      Currently over: <strong>{currentlyOver}</strong>
                    </div>
                    <div className="metaText faint">
                      Last updated: {secondsSinceFetch ?? 0}s ago
                    </div>
                  </>
                ) : (
                  <div className="metaText">
                    <strong>✅ Delivered</strong> — the bird has clocked out.
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
        </section>

        {/* GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 14, marginTop: 14 }}>
          {/* MAP CARD */}
          <div style={card}>
            <div className="kicker">Map</div>
            <div style={{ marginTop: 12 }}>
              <MapView
                origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
                dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
                progress={progress}
                tooltipText={`Currently over: ${currentlyOver}`}
              />
            </div>

            <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
              <div className="metaText faint">
                Distance: <strong>{letter.distance_km.toFixed(0)} km</strong>
              </div>
              <div className="metaText faint">
                Speed: <strong>{letter.speed_kmh.toFixed(0)} km/h</strong>
              </div>
            </div>
          </div>

          {/* PROGRESS CARD */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div className="kicker">Progress</div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", marginTop: 4 }}>
                  {Math.round(progress * 100)}%
                </div>
              </div>
              <div className="metaText faint" style={{ textAlign: "right" }}>
                {currentCheckpoint ? `Current: ${currentCheckpoint.name}` : ""}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  position: "relative",
                  height: 12,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.10)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(progress * 100)}%`,
                    background: "var(--ink)",
                    transition: "width 0.4s ease",
                  }}
                />
                {[25, 50, 75].map((p) => (
                  <div
                    key={p}
                    style={{
                      position: "absolute",
                      left: `${p}%`,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: "rgba(0,0,0,0.16)",
                      transform: "translateX(-1px)",
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {milestones.map((m) => (
                <div
                  key={m.pct}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: m.isPast ? "var(--card)" : "var(--soft)",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontWeight: 900 }}>{m.isPast ? "●" : "○"}</span>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{m.label}</div>
                  </div>
                  <div className="metaText faint">{new Date(m.atISO).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TIMELINE */}
        <div style={{ marginTop: 14, ...card }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.01em", margin: 0 }}>
              Timeline
            </h2>
            <div className="metaText faint">
              {delivered ? "Final log" : "Auto-updating"}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {[
              ...checkpoints.map((cp) => ({
                key: `cp-${cp.id}`,
                name: cp.name,
                at: cp.at,
                kind: "checkpoint" as const,
              })),
              ...milestones.map((m) => ({
                key: `ms-${m.pct}`,
                name: `🕊️ ${m.label}`,
                at: m.atISO,
                kind: "milestone" as const,
              })),
            ]
              .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
              .map((item) => {
                const isPast = new Date(item.at).getTime() <= now.getTime();
                const isMilestone = item.kind === "milestone";

                return (
                  <div
                    key={item.key}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: isMilestone ? "rgba(217,45,32,0.06)" : isPast ? "var(--card)" : "var(--soft)",
                      border: "1px solid rgba(0,0,0,0.06)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontWeight: 900 }}>{isPast ? "●" : "○"}</span>
                      <div style={{ fontWeight: 900 }}>{item.name}</div>
                    </div>
                    <div className="metaText faint">{new Date(item.at).toLocaleString()}</div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* MESSAGE */}
        <div style={{ marginTop: 14, position: "relative", ...card }}>
          <ConfettiBurst show={confetti} />

          <h2 style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.01em", margin: 0 }}>
            Letter from {letter.from_name || "Sender"} to {letter.to_name || "Recipient"}
          </h2>

          <div style={{ marginTop: 10, ...soft }}>
            <div style={{ fontWeight: 900, marginBottom: 10, fontSize: 14 }}>
              {letter.subject || "(No subject)"}
            </div>

            <div style={{ position: "relative" }}>
              <div
                className={delivered && revealStage === "open" ? "bodyReveal" : ""}
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.55,
                  fontSize: 14,
                  fontWeight: 650,
                  opacity: delivered ? 1 : 0,
                }}
              >
                {delivered ? (letter.body ?? "") : ""}
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

          <div style={{ marginTop: 14, opacity: 0.55, fontSize: 11, fontWeight: 800 }}>
            Token: {letter.public_token}
          </div>
        </div>
      </main>

      {/* ✅ Brand tokens + subtle grain + banner styles */}
      <style jsx global>{`
        :root {
          --bg: #f6f6f4;
          --card: #ffffff;
          --soft: #f0f0ed;
          --ink: #121212;

          /* brand tokens */
          --brand-cream: #f6f6f4;
          --brand-red: #d92d20;

          --shadow-lg: 0 12px 28px rgba(0, 0, 0, 0.10);
        }

        .pageBg {
          min-height: 100vh;
          background: var(--brand-cream);
          position: relative;
        }

        /* Subtle grain overlay */
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

        .kicker {
          font-size: 12px;
          font-weight: 900;
          opacity: 0.6;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .metaText {
          font-size: 12px;
          font-weight: 800;
          opacity: 0.8;
        }
        .metaText.faint {
          opacity: 0.6;
          font-weight: 800;
        }

        /* Route banner */
        .routeBanner {
          border-radius: 22px;
          padding: 18px;
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: var(--shadow-lg);
          position: relative;
          overflow: hidden;
        }

        /* solid block accent (Alpinhound-y) */
        .routeBanner::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, rgba(217,45,32,0.10), rgba(217,45,32,0.00) 55%),
            linear-gradient(0deg, rgba(0,0,0,0.03), rgba(0,0,0,0));
          pointer-events: none;
        }

        .routeHeadline {
          font-size: 34px;
          font-weight: 900;
          letter-spacing: -0.03em;
          margin-top: 8px;
          position: relative;
          z-index: 1;
        }

        .routeHeadline .arrow {
          opacity: 0.4;
          margin: 0 8px;
        }

        .subRow {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .etaBox {
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(0,0,0,0.04);
          border: 1px solid rgba(0,0,0,0.06);
          min-width: 260px;
          position: relative;
          z-index: 1;
        }

        .etaTime {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: -0.01em;
          margin-top: 4px;
        }
        .etaSub {
          font-size: 12px;
          font-weight: 800;
          opacity: 0.7;
          margin-top: 2px;
        }

        /* LIVE dot pulse */
        .liveWrap {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(217,45,32,0.10);
          border: 1px solid rgba(217,45,32,0.18);
        }
        .liveText {
          font-weight: 900;
          letter-spacing: 0.08em;
          font-size: 12px;
        }
        .liveDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--brand-red);
          box-shadow: 0 0 0 0 rgba(217, 45, 32, 0.40);
          animation: pulse 1.4s ease-out infinite;
          display: inline-block;
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(217, 45, 32, 0.35);
            transform: scale(1);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(217, 45, 32, 0);
            transform: scale(1.05);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(217, 45, 32, 0);
            transform: scale(1);
          }
        }

        /* seal crack */
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

        /* body reveal */
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

        /* confetti */
        .confetti {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: 18px;
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
          background: rgba(217, 45, 32, 0.92);
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