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

  // ✅ NEW from route.ts
  eta_at_adjusted?: string;

  // ✅ comes from /api/letters/[token]
  eta_utc_text?: string;
};

type Checkpoint = {
  id: string;
  idx: number;
  name: string;
  at: string;
  geo_text?: string;
};

type BadgeItem = {
  id: string;
  kind: "badge";
  code: string;
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  rarity?: "common" | "rare" | "legendary";
  earned_at?: string | null;
  meta?: any;
};

type AddonItem = {
  id: string;
  kind: "addon";
  code: string;
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  rarity?: "common" | "rare" | "legendary";
  earned_at?: string | null;
  meta?: any;
};

type LetterItems = {
  badges: BadgeItem[];
  addons: AddonItem[];
};

type Flight = {
  progress: number; // ✅ sleep-aware 0..1
  sleeping: boolean;
  sleep_until_iso: string | null;
  sleep_local_text: string; // e.g. "6:00 AM"
  tooltip_text: string; // ✅ already "Location: ..."
  marker_mode: "flying" | "sleeping" | "delivered";
};

// ✅ UPDATED: matches MapView.tsx
type MapStyle = "carto-positron" | "carto-voyager" | "carto-positron-nolabels";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
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

function formatUtcFallback(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.toISOString().replace("T", " ").replace("Z", "")} UTC`;
}

/* ---------- tiny icon system (inline SVG) ---------- */
function Ico({
  name,
  size = 16,
}: {
  name: "live" | "pin" | "speed" | "distance" | "check" | "mail" | "timeline";
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
          <path d="M12 12h.01" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        </svg>
      );
  }
}

/* ---------- wax seal overlay ---------- */
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

/* ---------- timeline rail ---------- */
function RailTimeline({
  items,
  now,
  currentKey,
}: {
  items: { key: string; name: string; at: string; kind: "checkpoint" | "milestone" }[];
  now: Date;
  currentKey: string | null;
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
          const isCurrent = currentKey === it.key;

          return (
            <div key={it.key} className="railItem">
              <div
                className={`railNode ${isPast ? "past" : ""} ${isMilestone ? "milestone" : ""} ${
                  shouldPop ? "pop" : ""
                }`}
              >
                <span className="railDot">{isPast ? "✓" : ""}</span>
              </div>

              <div
                className={`railCard ${isPast ? "past" : ""} ${isMilestone ? "milestone" : ""} ${
                  isCurrent ? "current" : ""
                }`}
              >
                {isCurrent && (
                  <div className="pigeonTag livePulseRow">
                    <span className="livePulseDot" aria-hidden />
                    <span>Pigeon is here</span>
                  </div>
                )}

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

function rarityLabel(r?: string) {
  if (r === "legendary") return "Legendary";
  if (r === "rare") return "Rare";
  return "Common";
}

export default function LetterStatusPage() {
  const params = useParams();
  const raw = (params as any)?.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  const [letter, setLetter] = useState<Letter | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [items, setItems] = useState<LetterItems>({ badges: [], addons: [] });
  const [flight, setFlight] = useState<Flight | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [delivered, setDelivered] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const [currentOverText, setCurrentOverText] = useState<string | null>(null);

  const prevDelivered = useRef(false);
  const [revealStage, setRevealStage] = useState<"idle" | "crack" | "open">("idle");
  const [confetti, setConfetti] = useState(false);

  const [mapStyle, setMapStyle] = useState<MapStyle>("carto-positron");

  useEffect(() => {
    const rawSaved = window.localStorage.getItem("pigeon_map_style");
    const saved = (rawSaved || "").trim();

    if (saved === "carto-dark") {
      setMapStyle("carto-positron-nolabels");
      window.localStorage.setItem("pigeon_map_style", "carto-positron-nolabels");
      return;
    }

    if (saved === "carto-positron" || saved === "carto-voyager" || saved === "carto-positron-nolabels") {
      setMapStyle(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("pigeon_map_style", mapStyle);
  }, [mapStyle]);

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
        const res = await fetch(`/api/letters/${encodeURIComponent(token)}`, { cache: "no-store" });
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
        setCurrentOverText(typeof data.current_over_text === "string" ? data.current_over_text : null);

        setFlight((data.flight ?? null) as Flight | null);

        const nextItems = (data.items ?? {}) as Partial<LetterItems>;
        setItems({
          badges: Array.isArray(nextItems.badges) ? (nextItems.badges as BadgeItem[]) : [],
          addons: Array.isArray(nextItems.addons) ? (nextItems.addons as AddonItem[]) : [],
        });

        setLastFetchedAt(new Date());
      } catch (e: any) {
        console.error("LOAD ERROR:", e);
        if (!alive) return;
        setError(e?.message ?? String(e));
      }
    };

    void load();
    const interval = setInterval(() => void load(), 15000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [token]);

  // Prefer adjusted ETA for countdown/progress (when present)
  const effectiveEtaISO = useMemo(() => {
    if (!letter) return "";
    return (letter.eta_at_adjusted && letter.eta_at_adjusted.trim()) || letter.eta_at;
  }, [letter]);

  const sleeping = !!flight?.sleeping;

  /**
   * ✅ UI safety net for "zombie letters":
   * If the ORIGINAL eta_at is clearly in the past, treat as delivered even if server says otherwise.
   * This prevents old letters from becoming LIVE after ETA adjustment logic changes.
   */
  const uiDelivered = useMemo(() => {
    if (!letter) return delivered;

    const etaOriginalMs = Date.parse(letter.eta_at);
    const etaOriginalPassed =
      Number.isFinite(etaOriginalMs) && now.getTime() > etaOriginalMs + 60_000; // 1 min grace

    // If server says delivered, we trust it.
    if (delivered) return true;

    // If it's sleeping, don't force-deliver purely because original ETA passed.
    // (Sleep can legitimately delay arrival.)
    if (sleeping) return false;

    // If it's not sleeping and the original ETA is passed, mark delivered for UI.
    return etaOriginalPassed;
  }, [letter, delivered, sleeping, now]);

  // progress: prefer server flight.progress; fallback local
  const progress = useMemo(() => {
    if (flight && Number.isFinite(flight.progress)) return clamp01(flight.progress);

    if (!letter) return 0;
    const sent = new Date(letter.sent_at).getTime();
    const eta = new Date(effectiveEtaISO).getTime();
    const t = now.getTime();
    if (eta <= sent) return 1;
    return clamp01((t - sent) / (eta - sent));
  }, [flight, letter, effectiveEtaISO, now]);

  const countdown = useMemo(() => {
    if (!letter) return "";
    const msLeft = new Date(effectiveEtaISO).getTime() - now.getTime();
    return formatCountdown(msLeft);
  }, [letter, effectiveEtaISO, now]);

  const milestones = useMemo(() => {
    if (!letter) return [];
    const defs = [
      { pct: 25, frac: 0.25, label: "25% reached" },
      { pct: 50, frac: 0.5, label: "50% reached" },
      { pct: 75, frac: 0.75, label: "75% reached" },
    ];

    return defs.map((m) => {
      const atISO = milestoneTimeISO(letter.sent_at, effectiveEtaISO, m.frac);
      const isPast = now.getTime() >= new Date(atISO).getTime();
      return { ...m, atISO, isPast };
    });
  }, [letter, effectiveEtaISO, now]);

  // ✅ current checkpoint: keep time-based “latest past” (fine)
  const currentCheckpoint = useMemo(() => {
    if (!checkpoints.length || !letter) return null;
    const t = now.getTime();
    let current: Checkpoint | null = null;
    for (const cp of checkpoints) {
      if (new Date(cp.at).getTime() <= t) current = cp;
    }
    return current ?? checkpoints[0];
  }, [checkpoints, letter, now]);

  const secondsSinceFetch = useMemo(() => {
    if (!lastFetchedAt) return null;
    return Math.max(0, Math.floor((now.getTime() - lastFetchedAt.getTime()) / 1000));
  }, [now, lastFetchedAt]);

  const currentlyOver = useMemo(() => {
    if (uiDelivered) return "Delivered";
    if (currentOverText && currentOverText.trim()) return currentOverText;

    const fallback =
      (currentCheckpoint?.geo_text && currentCheckpoint.geo_text.trim()) ||
      (currentCheckpoint?.name && currentCheckpoint.name.trim()) ||
      "somewhere over the U.S.";

    return fallback;
  }, [uiDelivered, currentOverText, currentCheckpoint]);

  const mapTooltip = useMemo(() => {
    if (flight?.tooltip_text && flight.tooltip_text.trim()) return flight.tooltip_text;
    if (uiDelivered) return "Location: Delivered";
    return `Location: ${currentlyOver || "somewhere over the U.S."}`;
  }, [flight?.tooltip_text, uiDelivered, currentlyOver]);

  const showLive = !uiDelivered;

  // ✅ Stable checkpoint ordering by idx (prevents “rearranged” flight log)
  const checkpointsOrdered = useMemo(() => {
    const cps = [...checkpoints];
    cps.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
    return cps;
  }, [checkpoints]);

  // ✅ Timeline items: checkpoints in idx order, then milestones (does NOT reorder checkpoints)
  const timelineItems = useMemo(() => {
    const cps = checkpointsOrdered.map((cp) => ({
      key: `cp-${cp.id}`,
      name: cp.name,
      at: cp.at,
      kind: "checkpoint" as const,
    }));

    const ms = milestones.map((m) => ({
      key: `ms-${m.pct}`,
      name: m.label,
      at: m.atISO,
      kind: "milestone" as const,
    }));

    return [...cps, ...ms];
  }, [checkpointsOrdered, milestones]);

  // Current key: still time-based, but doesn’t depend on sorting-by-at anymore
  const currentTimelineKey = useMemo(() => {
    if (uiDelivered) return null;
    if (!timelineItems.length) return null;

    const nowT = now.getTime();
    let bestKey: string | null = null;
    let bestT = -Infinity;

    for (const it of timelineItems) {
      const t = new Date(it.at).getTime();
      if (t <= nowT && t >= bestT) {
        bestT = t;
        bestKey = it.key;
      }
    }

    return bestKey;
  }, [timelineItems, now, uiDelivered]);

  const etaTextUTC = useMemo(() => {
    if (!letter) return "";
    return (letter.eta_utc_text && letter.eta_utc_text.trim()) || formatUtcFallback(effectiveEtaISO);
  }, [letter, effectiveEtaISO]);

  const badgesSorted = useMemo(() => {
    const b = items.badges ?? [];
    return [...b].sort((a, c) => {
      const ta = a.earned_at ? Date.parse(a.earned_at) : 0;
      const tb = c.earned_at ? Date.parse(c.earned_at) : 0;
      return ta - tb;
    });
  }, [items.badges]);

  // ✅ markerMode uses uiDelivered (prevents re-activating completed letters)
  const markerMode: Flight["marker_mode"] = uiDelivered ? "delivered" : sleeping ? "sleeping" : "flying";

  // confetti/reveal should trigger on UI-delivery transition (not just server)
  useEffect(() => {
    if (!prevDelivered.current && uiDelivered) {
      setRevealStage("crack");
      setConfetti(true);

      const t1 = setTimeout(() => setRevealStage("open"), 520);
      const t2 = setTimeout(() => setConfetti(false), 1400);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    prevDelivered.current = uiDelivered;
  }, [uiDelivered]);

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
                    <div className="liveStack" style={{ minWidth: 230, flex: "0 0 auto" }}>
                      <div className={`liveWrap ${sleeping ? "sleep" : ""}`}>
                        <span className={`liveDot ${sleeping ? "sleep" : ""}`} />
                        <span className="liveText">{sleeping ? "SLEEPING" : "LIVE"}</span>
                      </div>
                      <div className="liveSub">
                        {sleeping ? `Wakes at ${flight?.sleep_local_text || "soon"}` : `Last updated: ${secondsSinceFetch ?? 0}s ago`}
                      </div>
                    </div>

                    <div className="metaPill" style={{ flex: "1 1 auto" }}>
                      <span className="ico">
                        <Ico name="pin" />
                      </span>
                      <span>
                        Location: <strong>{currentlyOver}</strong>
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
              <div className="kicker">ETA (UTC)</div>
              <div className="etaTime">{etaTextUTC}</div>
              {!uiDelivered && <div className="etaSub">T-minus {countdown}</div>}
            </div>
          </div>

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
              <div className={uiDelivered && revealStage === "open" ? "bodyReveal" : ""} style={{ opacity: uiDelivered ? 1 : 0 }}>
                <div className="body">{uiDelivered ? (letter.body ?? "") : ""}</div>
              </div>

              {!uiDelivered || revealStage !== "open" ? (
                <div style={{ position: uiDelivered ? "absolute" : "relative", inset: 0 }}>
                  <WaxSealOverlay etaText={etaTextUTC} cracking={uiDelivered && revealStage === "crack"} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="token">Token: {letter.public_token}</div>
        </div>

        <div className="grid">
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div className="kicker">Map</div>

              <div className="mapStyleRow" role="group" aria-label="Map style">
                <button
                  type="button"
                  className={`mapStyleBtn ${mapStyle === "carto-positron" ? "on" : ""}`}
                  onClick={() => setMapStyle("carto-positron")}
                  aria-pressed={mapStyle === "carto-positron"}
                >
                  Light
                </button>

                <button
                  type="button"
                  className={`mapStyleBtn ${mapStyle === "carto-voyager" ? "on" : ""}`}
                  onClick={() => setMapStyle("carto-voyager")}
                  aria-pressed={mapStyle === "carto-voyager"}
                >
                  Voyager
                </button>

                <button
                  type="button"
                  className={`mapStyleBtn ${mapStyle === "carto-positron-nolabels" ? "on" : ""}`}
                  onClick={() => setMapStyle("carto-positron-nolabels")}
                  aria-pressed={mapStyle === "carto-positron-nolabels"}
                >
                  No Labels
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <MapView
                origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
                dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
                progress={progress}
                tooltipText={mapTooltip}
                mapStyle={mapStyle}
                markerMode={markerMode}
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
                <div className="muted">{`Current: ${currentlyOver}`}</div>
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

          <div className="stack">
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
                  {uiDelivered ? "Final" : "Auto"}
                </div>
              </div>

              <RailTimeline items={timelineItems} now={now} currentKey={currentTimelineKey} />
            </div>

            <div className="card">
              <div className="cardHead" style={{ marginBottom: 10 }}>
                <div>
                  <div className="kicker">Badges</div>
                  <div className="h2">Earned on this flight</div>
                </div>

                <div className="metaPill faint" title="Badges earned so far">
                  🏅 <strong>{badgesSorted.length}</strong>
                </div>
              </div>

              {badgesSorted.length === 0 ? (
                <div className="soft">
                  <div className="muted">None yet. The bird’s still grinding XP. 🕊️</div>
                </div>
              ) : (
                <div className="stack">
                  {badgesSorted.map((b) => (
                    <div key={b.id} className="soft" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div
                        className="metaPill"
                        style={{
                          padding: "8px 10px",
                          background: "rgba(0,0,0,0.04)",
                          border: "1px solid rgba(0,0,0,0.10)",
                          flex: "0 0 auto",
                        }}
                        aria-label="Badge icon"
                        title={rarityLabel(b.rarity)}
                      >
                        <span style={{ fontSize: 16, lineHeight: "16px" }}>{b.icon || "🏅"}</span>
                      </div>

                      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 900, letterSpacing: "-0.01em" }}>{b.title}</div>
                          <div className="muted" style={{ fontSize: 11 }}>
                            {rarityLabel(b.rarity)}
                            {b.earned_at ? ` • ${new Date(b.earned_at).toLocaleString()}` : ""}
                          </div>
                        </div>

                        {b.subtitle ? (
                          <div className="muted" style={{ marginTop: 4 }}>
                            {b.subtitle}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </main>
  );
}