"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

function WaxSealOverlay({ etaText }: { etaText: string }) {
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          borderRadius: 14,
          padding: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          overflow: "hidden",
        }}
      >
        {/* Blur veil to hide the content behind */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            background: "rgba(0,0,0,0.25)",
          }}
        />

        {/* Seal */}
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
                "radial-gradient(circle at 70% 75%, rgba(0,0,0,0.35), rgba(0,0,0,0) 45%)," +
                "linear-gradient(145deg, #8b0f18, #5b0a10)",
              boxShadow:
                "0 10px 30px rgba(0,0,0,0.45), inset 0 2px 10px rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.18)",
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
                border: "1px dashed rgba(255,255,255,0.35)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                letterSpacing: 1,
                color: "rgba(255,255,255,0.9)",
                fontSize: 14,
                textTransform: "uppercase",
              }}
            >
              AH
            </div>
          </div>

          <div style={{ position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              Sealed until delivery
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Opens at {etaText}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
              No peeking. The bird is watching.
            </div>
          </div>
        </div>

        {/* Subtle “paper fibers” noise */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.07,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.25) 0px, rgba(255,255,255,0.25) 1px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)",
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

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

export default function LetterStatusPage() {
  const params = useParams();
  const raw = (params as any)?.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  const [letter, setLetter] = useState<Letter | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [delivered, setDelivered] = useState(false);

  // tiny UX: show “copied”
  const [copied, setCopied] = useState(false);

  // clock tick (for ETA countdown)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // load letter + checkpoints from API
  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setError(null);

        const res = await fetch(`/api/letters/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.error ?? "Letter not found");
          return;
        }

        setLetter(data.letter as Letter);
        setDelivered(!!data.delivered);
        setCheckpoints((data.checkpoints ?? []) as Checkpoint[]);
      } catch (e: any) {
        console.error("LOAD ERROR:", e);
        setError(e?.message ?? String(e));
      }
    };

    load();
  }, [token]);

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

  // milestone model (computed client-side)
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

  const statusUrl = useMemo(() => {
    if (!letter) return "";
    return `${window.location.origin}/l/${letter.public_token}`;
  }, [letter]);

  const timelineItems = useMemo(() => {
    const cps = checkpoints.map((cp) => ({
      key: `cp-${cp.id}`,
      name: cp.name,
      at: cp.at,
      kind: "checkpoint" as const,
      id: cp.id,
    }));

    const ms = milestones.map((m) => ({
      key: `ms-${m.pct}`,
      name: `🕊️ ${m.label}`,
      at: m.atISO,
      kind: "milestone" as const,
      id: `m-${m.pct}`,
    }));

    return [...cps, ...ms].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
    );
  }, [checkpoints, milestones]);

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Flight Status</h1>
        <p style={{ color: "crimson", marginTop: 12 }}>❌ {error}</p>
      </main>
    );
  }

  if (!letter) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Flight Status</h1>
        <p style={{ marginTop: 12, opacity: 0.7 }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860, margin: "0 auto" }}>
      {/* ---------- Top header card ---------- */}
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 18,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
              Flight Status
            </div>

            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, lineHeight: 1.15 }}>
              {letter.origin_name} → {letter.dest_name}
            </h1>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                <strong>ETA:</strong> {new Date(letter.eta_at).toLocaleString()}
                {!delivered && (
                  <span style={{ marginLeft: 8, opacity: 0.75 }}>
                    (T-minus {countdown})
                  </span>
                )}
              </div>

              <div style={{ fontSize: 13, opacity: 0.85 }}>
                <strong>Distance:</strong> {letter.distance_km.toFixed(0)} km
              </div>

              <div style={{ fontSize: 13, opacity: 0.85 }}>
                <strong>Speed:</strong> {letter.speed_kmh.toFixed(0)} km/h
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
            {/* status pill */}
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: 0.3,
                opacity: 0.95,
                background: delivered
                  ? "rgba(80, 220, 140, 0.12)"
                  : "rgba(255, 255, 255, 0.06)",
              }}
            >
              {delivered ? "✅ Delivered" : "🕊️ In Flight"}
            </div>

            {/* copy link */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(statusUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                } catch {
                  // fallback: do nothing
                }
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                fontWeight: 800,
                cursor: "pointer",
                fontSize: 12,
                opacity: 0.9,
                minWidth: 120,
              }}
              title="Copy share link"
            >
              {copied ? "✅ Copied" : "🔗 Copy link"}
            </button>
          </div>
        </div>

        {/* progress bar + ticks */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              position: "relative",
              height: 12,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round(progress * 100)}%`,
                background: "white",
                opacity: 0.95,
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
                  background: "rgba(255,255,255,0.25)",
                  transform: "translateX(-1px)",
                }}
              />
            ))}
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            {Math.round(progress * 100)}%{" "}
            {currentCheckpoint ? `• Current: ${currentCheckpoint.name}` : ""}
          </div>

          {/* milestone chips */}
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {milestones.map((m) => (
              <div
                key={m.pct}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.03)",
                  opacity: m.isPast ? 1 : 0.55,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 900 }}>{m.isPast ? "●" : "○"}</span>
                <span style={{ fontWeight: 800 }}>{m.label}</span>
                <span style={{ opacity: 0.75 }}>
                  {new Date(m.atISO).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Map card ---------- */}
      <div
        style={{
          marginTop: 16,
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
          <div style={{ fontWeight: 900 }}>Route Map</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Pigeon position updates are ETA-based. The bird refuses GPS collars.
          </div>
        </div>

        <div style={{ padding: 12 }}>
          <MapView
            origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
            dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
            progress={progress}
          />
        </div>

        <div
          style={{
            padding: 12,
            borderTop: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            fontSize: 12,
            opacity: 0.85,
          }}
        >
          <div>
            <strong>Route:</strong> {letter.origin_name} → {letter.dest_name}
          </div>
          <div>
            <strong>Distance:</strong> {letter.distance_km.toFixed(0)} km
          </div>
          <div>
            <strong>Speed:</strong> {letter.speed_kmh.toFixed(0)} km/h
          </div>
        </div>
      </div>

      {/* ---------- Two-column area (timeline + letter) ---------- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        {/* Timeline */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 14,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>Flight Log</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            A tasteful illusion of logistics.
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {timelineItems.map((item) => {
              const isPast = new Date(item.at).getTime() <= now.getTime();
              const isMilestone = item.kind === "milestone";
              const isCurrentCheckpoint =
                item.kind === "checkpoint" && currentCheckpoint?.id === item.id;

              return (
                <div
                  key={item.key}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: isCurrentCheckpoint
                      ? "rgba(255,255,255,0.10)"
                      : isMilestone
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(255,255,255,0.02)",
                    opacity: isPast ? 1 : 0.55,
                    transform: isCurrentCheckpoint ? "translateY(-1px)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 900 }}>
                      {isCurrentCheckpoint ? "🟡" : isPast ? "●" : "○"} {item.name}
                    </div>

                    {isCurrentCheckpoint && (
                      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>
                        current
                      </div>
                    )}
                  </div>

                  <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
                    {new Date(item.at).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Letter */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: 14,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            Letter from {letter.from_name || "Sender"} to {letter.to_name || "Recipient"}
          </div>

          <div
            style={{
              marginTop: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              overflow: "hidden",
              background: "rgba(0,0,0,0.15)",
            }}
          >
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div style={{ fontWeight: 900 }}>{letter.subject || "(No subject)"}</div>
            </div>

            <div style={{ padding: 14 }}>
              {delivered ? (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.55,
                    animation: "reveal 420ms ease-out",
                  }}
                >
                  {letter.body ?? ""}
                </div>
              ) : (
                <WaxSealOverlay etaText={new Date(letter.eta_at).toLocaleString()} />
              )}
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
            Token: {letter.public_token}
          </div>
        </div>
      </div>

      {/* Desktop layout: timeline + letter side-by-side */}
      <style jsx global>{`
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

        @media (min-width: 980px) {
          main > div:nth-of-type(3) {
            grid-template-columns: 1fr 1fr;
            align-items: start;
          }
        }
      `}</style>
    </main>
  );
}