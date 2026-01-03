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
  if (!Number.isFinite(sent) || !Number.isFinite(eta) || eta <= sent) return 1;
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function WaxSealOverlay({
  etaText,
  cracking = false,
}: {
  etaText: string;
  cracking?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          borderRadius: 16,
          padding: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          overflow: "hidden",
        }}
      >
        {/* Blur veil */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            background: "rgba(0,0,0,0.28)",
          }}
        />

        {/* subtle fibers */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.25) 0px, rgba(255,255,255,0.25) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)",
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />

        {/* Seal row */}
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
              width: 70,
              height: 70,
              borderRadius: 999,
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%)," +
                "radial-gradient(circle at 70% 75%, rgba(0,0,0,0.35), rgba(0,0,0,0) 45%)," +
                "linear-gradient(145deg, #b0121e, #5b0a10)",
              boxShadow:
                "0 14px 40px rgba(0,0,0,0.55), inset 0 2px 12px rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.18)",
              display: "grid",
              placeItems: "center",
              transform: cracking ? "rotate(-8deg) scale(1.02)" : "rotate(-8deg)",
              animation: cracking ? "sealCrack 520ms ease-out" : undefined,
            }}
            aria-label="Wax seal"
            title="Sealed until delivery"
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "1px dashed rgba(255,255,255,0.38)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                letterSpacing: 1,
                color: "rgba(255,255,255,0.92)",
                fontSize: 14,
                textTransform: "uppercase",
              }}
            >
              AH
            </div>

            {/* crack line */}
            {cracking && (
              <div
                style={{
                  position: "absolute",
                  inset: 10,
                  borderRadius: 999,
                  background:
                    "linear-gradient(120deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0) 60%)",
                  opacity: 0.55,
                  transform: "rotate(18deg)",
                  pointerEvents: "none",
                }}
              />
            )}
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
      </div>
    </div>
  );
}

/** tiny confetti burst */
function ConfettiBurst({ show }: { show: boolean }) {
  if (!show) return null;

  const pieces = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: 16,
      }}
    >
      {pieces.map((i) => {
        const left = (i * 97) % 100; // pseudo-random but stable
        const delay = (i % 6) * 25;
        const rot = (i * 43) % 360;
        const drift = ((i % 7) - 3) * 18;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: -10,
              width: 8,
              height: 14,
              borderRadius: 2,
              background:
                i % 3 === 0
                  ? "#ffffff"
                  : i % 3 === 1
                  ? "rgba(255,255,255,0.55)"
                  : "rgba(176,18,30,0.95)",
              transform: `rotate(${rot}deg)`,
              animation: `confettiDrop 900ms ease-out ${delay}ms forwards`,
              filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.35))",
              "--drift": `${drift}px`,
            } as any}
          />
        );
      })}
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

  // “legit” last-updated timer
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  // delivery celebration + seal crack
  const [celebrate, setCelebrate] = useState(false);
  const [sealCracking, setSealCracking] = useState(false);
  const prevDeliveredRef = useRef<boolean>(false);

  // tick for countdown + last-updated
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // fetch function (shared by initial load + polling)
  async function fetchStatus() {
    if (!token) return;

    const res = await fetch(`/api/letters/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Letter not found");

    setLetter(data.letter as Letter);
    setDelivered(!!data.delivered);
    setCheckpoints((data.checkpoints ?? []) as Checkpoint[]);
    setLastFetchedAt(new Date());
  }

  // initial load + polling while in-flight
  useEffect(() => {
    if (!token) return;

    let mounted = true;

    (async () => {
      try {
        setError(null);
        await fetchStatus();
      } catch (e: any) {
        if (!mounted) return;
        console.error("LOAD ERROR:", e);
        setError(e?.message ?? String(e));
      }
    })();

    // poll every 10s while in-flight (feels live)
    const poll = setInterval(async () => {
      try {
        // only poll if not delivered (keeps it cheap)
        if (!prevDeliveredRef.current) {
          await fetchStatus();
        }
      } catch (e) {
        // ignore poll errors (don’t spam UI)
        console.warn("POLL ERROR:", e);
      }
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // trigger delivery moment
  useEffect(() => {
    const prev = prevDeliveredRef.current;
    if (!prev && delivered) {
      setSealCracking(true);
      setCelebrate(true);

      const t1 = setTimeout(() => setSealCracking(false), 650);
      const t2 = setTimeout(() => setCelebrate(false), 1400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prevDeliveredRef.current = delivered;
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

  const pigeon = useMemo(() => {
    if (!letter) return null;
    const lat = lerp(letter.origin_lat, letter.dest_lat, progress);
    const lon = lerp(letter.origin_lon, letter.dest_lon, progress);

    const over = currentCheckpoint?.name
      ? `Currently over: ${currentCheckpoint.name}`
      : "Currently over: Somewhere majestic";

    return { lat, lon, label: over };
  }, [letter, progress, currentCheckpoint]);

  const secondsSinceUpdate = useMemo(() => {
    if (!lastFetchedAt) return null;
    const s = Math.max(0, Math.floor((now.getTime() - lastFetchedAt.getTime()) / 1000));
    return s;
  }, [now, lastFetchedAt]);

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, Segoe UI, Roboto, Arial', maxWidth: 900, margin: "0 auto", color: "#fff" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.3 }}>Flight Status</h1>
        <p style={{ color: "#ff4d4d", marginTop: 12 }}>❌ {error}</p>
      </main>
    );
  }

  if (!letter) {
    return (
      <main style={{ padding: 24, fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, Segoe UI, Roboto, Arial', maxWidth: 900, margin: "0 auto", color: "#fff" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.3 }}>Flight Status</h1>
        <p style={{ marginTop: 12, opacity: 0.7 }}>Loading…</p>
      </main>
    );
  }

  const isLive = !delivered;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        fontFamily: '"Bricolage Grotesque", system-ui, -apple-system, Segoe UI, Roboto, Arial',
        color: "rgba(255,255,255,0.92)",
        background:
          "radial-gradient(1200px 700px at 20% 10%, rgba(176,18,30,0.20), rgba(0,0,0,0) 55%)," +
          "radial-gradient(900px 600px at 80% 30%, rgba(255,255,255,0.06), rgba(0,0,0,0) 60%)," +
          "linear-gradient(180deg, #0a0a0b, #050506)",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ opacity: 0.75, fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" }}>
              Carrier Pigeon • Flight Status
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.8, marginTop: 8, marginBottom: 0 }}>
              {letter.origin_name} → {letter.dest_name}
            </h1>
          </div>

          {/* LIVE pill */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              marginTop: 4,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              {isLive ? (
                <>
                  <span className="liveDot" />
                  <span style={{ fontWeight: 900, letterSpacing: 0.3 }}>LIVE</span>
                  <span style={{ opacity: 0.8, fontWeight: 800 }}>In Flight</span>
                </>
              ) : (
                <>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.75)" }} />
                  <span style={{ fontWeight: 900, letterSpacing: 0.3 }}>DONE</span>
                  <span style={{ opacity: 0.8, fontWeight: 800 }}>Delivered</span>
                </>
              )}
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {secondsSinceUpdate === null ? "Last updated: —" : `Last updated: ${secondsSinceUpdate}s ago`}
            </div>
          </div>
        </div>

        {/* top stats cards */}
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          <div style={card()}>
            <div style={label()}>ETA</div>
            <div style={value()}>{new Date(letter.eta_at).toLocaleString()}</div>
            {!delivered && <div style={subtle()}>(T-minus {countdown})</div>}
          </div>

          <div style={card()}>
            <div style={label()}>Distance</div>
            <div style={value()}>{letter.distance_km.toFixed(0)} km</div>
            <div style={subtle()}>Speed: {letter.speed_kmh.toFixed(0)} km/h</div>
          </div>

          <div style={card()}>
            <div style={label()}>Progress</div>
            <div style={value()}>{Math.round(progress * 100)}%</div>
            <div style={subtle()}>{currentCheckpoint ? `Currently: ${currentCheckpoint.name}` : "In transit"}</div>
          </div>
        </div>

        {/* map + progress */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
          <div style={{ ...card(), padding: 12, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <div style={{ fontWeight: 900, letterSpacing: -0.2 }}>Flight Path</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {pigeon?.label ?? ""}
              </div>
            </div>

            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}>
              <MapView
                origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
                dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
                progress={progress}
                pigeon={pigeon || undefined} // ✅ requires MapView tiny update (below)
              />
            </div>

            {/* delivery confetti over the map card */}
            <ConfettiBurst show={celebrate} />
          </div>

          <div style={{ ...card(), padding: 14 }}>
            <div style={{ fontWeight: 900, letterSpacing: -0.2 }}>Milestones</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {milestones.map((m) => (
                <div
                  key={m.pct}
                  style={{
                    padding: "10px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: m.isPast ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                    opacity: m.isPast ? 1 : 0.6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 900 }}>{m.isPast ? "●" : "○"}</span>
                    <div style={{ fontWeight: 900 }}>{m.label}</div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {new Date(m.atISO).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>

            {/* progress bar */}
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  position: "relative",
                  height: 12,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(progress * 100)}%`,
                    background: "linear-gradient(90deg, rgba(255,255,255,0.9), rgba(176,18,30,0.95))",
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
                      background: "rgba(0,0,0,0.25)",
                      transform: "translateX(-1px)",
                    }}
                  />
                ))}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                {Math.round(progress * 100)}% • {currentCheckpoint ? `Current: ${currentCheckpoint.name}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* timeline */}
        <div style={{ marginTop: 14, ...card(), padding: 14 }}>
          <div style={{ fontWeight: 900, letterSpacing: -0.2 }}>Timeline</div>
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
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
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: isMilestone ? "rgba(176,18,30,0.10)" : "rgba(255,255,255,0.03)",
                      opacity: isPast ? 1 : 0.55,
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {isPast ? "●" : "○"} {item.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {new Date(item.at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* message */}
        <div style={{ marginTop: 14, ...card(), padding: 14, position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 900, letterSpacing: -0.2 }}>
              Letter from {letter.from_name || "Sender"} to {letter.to_name || "Recipient"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Token: {letter.public_token}</div>
          </div>

          <div style={{ marginTop: 10, fontWeight: 900, opacity: 0.95 }}>
            {letter.subject || "(No subject)"}
          </div>

          <div style={{ marginTop: 10 }}>
            {delivered ? (
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  animation: "reveal 420ms ease-out",
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {letter.body ?? ""}
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <WaxSealOverlay
                  etaText={new Date(letter.eta_at).toLocaleString()}
                  cracking={sealCracking}
                />
                <ConfettiBurst show={celebrate} />
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, opacity: 0.55 }}>
          Built for the pack • powered by extremely motivated pigeons.
        </div>
      </div>

      <style jsx global>{`
        .liveDot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(176, 18, 30, 0.95);
          box-shadow: 0 0 0 0 rgba(176, 18, 30, 0.55);
          animation: livePulse 1.2s ease-out infinite;
        }

        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(176, 18, 30, 0.55); transform: scale(1); }
          70% { box-shadow: 0 0 0 10px rgba(176, 18, 30, 0); transform: scale(1.06); }
          100% { box-shadow: 0 0 0 0 rgba(176, 18, 30, 0); transform: scale(1); }
        }

        @keyframes reveal {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes confettiDrop {
          from { transform: translateY(0) rotate(0deg); opacity: 1; }
          to { transform: translateY(420px) translateX(var(--drift)) rotate(180deg); opacity: 0; }
        }

        @keyframes sealCrack {
          0% { transform: rotate(-8deg) scale(1); filter: brightness(1); }
          45% { transform: rotate(-10deg) scale(1.04); filter: brightness(1.06); }
          100% { transform: rotate(-8deg) scale(1.02); filter: brightness(1); }
        }
      `}</style>
    </main>
  );
}

/* tiny style helpers */
function card(): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    padding: 14,
  };
}

function label(): React.CSSProperties {
  return {
    fontSize: 12,
    opacity: 0.7,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontWeight: 900,
  };
}

function value(): React.CSSProperties {
  return {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: -0.2,
    marginTop: 6,
  };
}

function subtle(): React.CSSProperties {
  return { marginTop: 6, fontSize: 12, opacity: 0.7 };
}