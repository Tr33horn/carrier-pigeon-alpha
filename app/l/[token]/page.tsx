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

// compute milestone timestamp between sent_at and eta_at
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
    <div
      className={cracking ? "seal crack" : "seal"}
      style={{ position: "relative" }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 18,
          padding: 18,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.70), rgba(255,255,255,0.35))",
          overflow: "hidden",
          boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
        }}
      >
        {/* veil */}
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
          {/* wax */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "999px",
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%)," +
                "radial-gradient(circle at 70% 75%, rgba(0,0,0,0.20), rgba(0,0,0,0) 45%)," +
                "linear-gradient(145deg, #D92D20, #8B1A12)",
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
                border: "1px dashed rgba(255,255,255,0.65)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                letterSpacing: 1,
                color: "rgba(255,255,255,0.95)",
                fontSize: 14,
                textTransform: "uppercase",
              }}
            >
              AH
            </div>
          </div>

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
              Sealed until delivery
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Opens at {etaText}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              No peeking. The bird is watching.
            </div>
          </div>
        </div>

        {/* “paper fibers” */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

/* ---------- tiny confetti ---------- */
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

  // “legit” freshness
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // delivery micro interaction
  const prevDelivered = useRef(false);
  const [revealStage, setRevealStage] = useState<"idle" | "crack" | "open">("idle");
  const [confetti, setConfetti] = useState(false);

  /* tick */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* loader */
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

    // refresh every 15s while in flight (feels “live”)
    const interval = setInterval(() => load(), 15000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [token]);

  /* delivery animation sequencing */
  useEffect(() => {
    // detect false -> true transition
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
    // “fake it til the pigeon makes it”
    return currentCheckpoint?.name ? currentCheckpoint.name : "somewhere over the U.S.";
  }, [delivered, currentCheckpoint]);

  /* ---------- styles ---------- */
  const page = {
    padding: 24,
    fontFamily: `"Bricolage Grotesque", system-ui, -apple-system, Segoe UI, Roboto, Arial`,
    maxWidth: 920,
    margin: "0 auto",
    color: "#111",
  } as const;

  const card = {
    background: "#FFF",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
  } as const;

  const cardSoft = {
    background: "#F0F0ED",
    borderRadius: 18,
    padding: 16,
  } as const;

  if (error) {
    return (
      <main style={{ ...page, background: "#F6F6F4", minHeight: "100vh" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
          Flight Status
        </h1>
        <p style={{ color: "#D92D20", marginTop: 12, fontWeight: 700 }}>❌ {error}</p>
      </main>
    );
  }

  if (!letter) {
    return (
      <main style={{ ...page, background: "#F6F6F4", minHeight: "100vh" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>
          Flight Status
        </h1>
        <p style={{ marginTop: 12, opacity: 0.7, fontWeight: 600 }}>Loading…</p>
      </main>
    );
  }

  const showLive = !delivered;

  return (
    <main style={{ ...page, background: "#F6F6F4", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            Flight Status
          </h1>

          {/* LIVE row */}
          <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
            {showLive ? (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="liveDot" />
                  <span style={{ fontWeight: 900, letterSpacing: "0.04em", fontSize: 12 }}>
                    LIVE
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>
                  Currently over: <span style={{ opacity: 1 }}>{currentlyOver}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>
                ✅ Delivered
              </div>
            )}
          </div>

          {showLive && (
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, marginTop: 4 }}>
              Last updated: {secondsSinceFetch ?? 0}s ago
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.6 }}>ETA</div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>
            {new Date(letter.eta_at).toLocaleString()}
          </div>
          {!delivered && (
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginTop: 2 }}>
              T-minus {countdown}
            </div>
          )}
        </div>
      </div>

      {/* Route + Map */}
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.6 }}>Route</div>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.01em", marginTop: 4 }}>
            {letter.origin_name} <span style={{ opacity: 0.45 }}>→</span> {letter.dest_name}
          </div>

          <div style={{ marginTop: 14 }}>
            <MapView
              origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
              dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
              progress={progress}
              tooltipText={`Currently over: ${currentlyOver}`}
            />
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>
              Distance: <span style={{ opacity: 1 }}>{letter.distance_km.toFixed(0)} km</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>
              Speed: <span style={{ opacity: 1 }}>{letter.speed_kmh.toFixed(0)} km/h</span>
            </div>
          </div>
        </div>

        {/* Progress + milestones */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.6 }}>Progress</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>
                {Math.round(progress * 100)}%
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>
              {currentCheckpoint ? `Current: ${currentCheckpoint.name}` : ""}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div
              style={{
                position: "relative",
                height: 12,
                borderRadius: 999,
                background: "#E6E6E2",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(progress * 100)}%`,
                  background: "#111",
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
                    background: "rgba(17,17,17,0.18)",
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
                  background: m.isPast ? "#FFFFFF" : "#F0F0ED",
                  boxShadow: m.isPast ? "0 8px 18px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontWeight: 900 }}>{m.isPast ? "●" : "○"}</span>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{m.label}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.6 }}>
                  {new Date(m.atISO).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 14, ...card }}>
        <h2 style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.01em", margin: 0 }}>
          Timeline
        </h2>

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
                    background: isMilestone ? "#F7F2EC" : isPast ? "#FFFFFF" : "#F0F0ED",
                    boxShadow: isPast ? "0 8px 18px rgba(0,0,0,0.08)" : "none",
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

                  <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.65 }}>
                    {new Date(item.at).toLocaleString()}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Message */}
      <div style={{ marginTop: 14, position: "relative", ...card }}>
        <ConfettiBurst show={confetti} />

        <h2 style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.01em", margin: 0 }}>
          Letter from {letter.from_name || "Sender"} to {letter.to_name || "Recipient"}
        </h2>

        <div style={{ marginTop: 10, ...cardSoft }}>
          <div style={{ fontWeight: 900, marginBottom: 10, fontSize: 14 }}>
            {letter.subject || "(No subject)"}
          </div>

          {/* Reveal stack: seal cracks, then body appears */}
          <div style={{ position: "relative" }}>
            {/* body */}
            <div
              className={delivered && revealStage === "open" ? "bodyReveal" : ""}
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
                fontSize: 14,
                fontWeight: 600,
                opacity: delivered ? 1 : 0,
              }}
            >
              {delivered ? (letter.body ?? "") : ""}
            </div>

            {/* seal overlay */}
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

      {/* global styles */}
      <style jsx global>{`
        /* LIVE dot pulse */
        .liveDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #d92d20;
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
          background: rgba(17, 17, 17, 0.9);
          transform: translateX(-50%);
          animation: confettiFall 1100ms ease-out forwards;
        }
        .confetti-bit:nth-child(3n) {
          background: rgba(217, 45, 32, 0.92);
        }
        .confetti-bit:nth-child(4n) {
          background: rgba(0, 0, 0, 0.35);
        }

        /* scatter positions */
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