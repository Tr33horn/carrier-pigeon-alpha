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

  bird?: "pigeon" | "snipe" | "goose" | null;

  eta_at_adjusted?: string;
  eta_utc_text?: string;

  archived_at?: string | null;
  canceled_at?: string | null;
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
  progress: number; // sleep-aware 0..1
  sleeping: boolean;
  sleep_until_iso: string | null;
  sleep_local_text: string; // e.g. "6:00 AM"
  tooltip_text: string; // "Location: ..."
  marker_mode: "flying" | "sleeping" | "delivered" | "canceled";

  // server-provided so UI never has to guess
  current_speed_kmh?: number;
};

type MapStyle = "carto-positron" | "carto-voyager" | "carto-positron-nolabels";

// ✅ add delivered
type TimelineKind = "checkpoint" | "sleep" | "day" | "delivered";

type TimelineItem = {
  key: string;
  name: string;
  at: string; // ISO
  kind: TimelineKind;
};

type BirdType = "pigeon" | "snipe" | "goose";

function inferBird(letter: Letter | null): BirdType {
  const raw = String((letter as any)?.bird || "").toLowerCase();
  if (raw === "pigeon" || raw === "snipe" || raw === "goose") return raw as BirdType;

  const sp = Number((letter as any)?.speed_kmh);
  if (Number.isFinite(sp) && sp >= 80) return "snipe";
  if (Number.isFinite(sp) && sp <= 60) return "goose";
  return "pigeon";
}

function birdLabel(b: BirdType) {
  if (b === "snipe") return "Great Snipe";
  if (b === "goose") return "Canada Goose";
  return "Homing Pigeon";
}

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

function formatUtcFallback(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";

  // Example: "1/8/2026, 4:56:01 PM UTC"
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(d) + " UTC"
  );
}

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

function timeLabelLocal(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
}

/* ---------- tiny icon system (inline SVG) ---------- */
function Ico({
  name,
  size = 16,
}: {
  name: "live" | "pin" | "speed" | "distance" | "check" | "mail" | "timeline" | "moon" | "x";
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
    case "x":
      return (
        <svg {...common}>
          <path
            d="M18 6 6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path
            d="M21 14.2A7.5 7.5 0 0 1 9.8 3a6.6 6.6 0 1 0 11.2 11.2Z"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
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
          <path d="M5 13a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M12 13l4.5-4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 13h2M18 13h2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "distance":
      return (
        <svg {...common}>
          <path d="M7 7h10M7 17h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
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
          <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <path d="M4 7h16v10H4V7Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="m4 8 8 6 8-6" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      );
    case "timeline":
      return (
        <svg {...common}>
          <path d="M7 6h10M7 12h10M7 18h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "live":
    default:
      return (
        <svg {...common}>
          <path d="M4 12a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M8 12a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M12 12h.01" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        </svg>
      );
  }
}

/** ✅ Bird image based on bird + state */
function birdImageSrc(bird: BirdType, mode: "flying" | "sleeping" | "delivered" | "canceled") {
  const base = bird === "snipe" ? "great-snipe" : bird === "goose" ? "canada-goose" : "homing-pigeon";
  const state = mode === "sleeping" ? "sleep" : mode === "delivered" ? "landed" : mode === "canceled" ? "landed" : "fly";
  return `/birds/${base}-${state}.gif`;
}

function BirdStatusCard({
  bird,
  mode,
  wakeText,
}: {
  bird: BirdType;
  mode: "flying" | "sleeping" | "delivered" | "canceled";
  wakeText?: string;
}) {
  const src = birdImageSrc(bird, mode);

  const label =
    mode === "canceled"
      ? "Recalled"
      : mode === "delivered"
      ? "Delivered"
      : mode === "sleeping"
      ? `Sleeping${wakeText ? ` · wakes ${wakeText}` : ""}`
      : "In flight";

  return (
    <div className="birdStatusCard">
      <div className="birdStatusRow">
        <div className={`birdStatusThumb ${mode}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${bird} bird`} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="birdStatusTitle">{birdLabel(bird)}</div>
          <div className="muted" style={{ marginTop: 2 }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- wax seal overlay ---------- */
function WaxSealOverlay({
  etaText,
  cracking,
  canceled,
}: {
  etaText: string;
  cracking?: boolean;
  canceled?: boolean;
}) {
  return (
    <div className={cracking ? "seal crack" : "seal"} style={{ position: "relative" }}>
      <div className="sealCard">
        <div className="sealVeil" />

        <div className="sealRow">
          <div className="wax" aria-label="Wax seal" title="Sealed until delivery">
{/* eslint-disable-next-line @next/next/no-img-element */}
<img
  src="/waxseal.png"
  alt="Wax seal"
  className="waxImg"
/>
          </div>

          <div>
            <div className="sealTitle">{canceled ? "Canceled" : "Sealed until delivery"}</div>
            <div className="sealSub">
              {canceled ? "This letter will not be delivered." : `Opens at ${etaText}`}
            </div>
            <div className="sealHint">
              {canceled ? "The bird was recalled to HQ." : "No peeking. The bird is watching."}
            </div>
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

/* ---------- timeline rail (grouped by day + sleep blocks) ---------- */
function RailTimeline({
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
      const isPast = final || new Date(it.at).getTime() <= now.getTime(); // ✅ Final forces past
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

          // ✅ delivered row is always past; final forces everything past
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
                    ? {
                        background: "rgba(88,80,236,0.08)",
                        borderColor: "rgba(88,80,236,0.35)",
                      }
                    : isDeliveredRow
                    ? {
                        background: "rgba(34,197,94,0.10)",
                        borderColor: "rgba(34,197,94,0.40)",
                      }
                    : undefined
                }
              >
                {isCurrent && (
                  <div className="pigeonTag livePulseRow" style={isSleep ? { background: "rgb(88,80,236)" } : undefined}>
                    <span className="livePulseDot" aria-hidden />
                    <span>{isSleep ? `${birdName} is sleeping` : `${birdName} is here`}</span>
                  </div>
                )}

                <div className="railTitleRow">
                  <div className="railTitle">{it.name}</div>
                  <div className="railTime">{timeLabelLocal(it.at)}</div>
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

function isSleepCheckpoint(cp: Checkpoint) {
  const id = (cp.id || "").toLowerCase();
  const name = (cp.name || "").toLowerCase();
  const geo = (cp.geo_text || "").toLowerCase();
  return id.startsWith("sleep-") || geo === "sleeping" || name.includes("slept") || name.startsWith("sleeping");
}

export default function LetterStatusPage() {
  const params = useParams() as Record<string, string | string[] | undefined>;

  // ✅ robust param: supports [token], [public_token], [id]
  const raw = params?.token ?? params?.public_token ?? params?.id;
  const token = Array.isArray(raw) ? raw[0] : raw;

  const [letter, setLetter] = useState<Letter | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [items, setItems] = useState<LetterItems>({ badges: [], addons: [] });
  const [flight, setFlight] = useState<Flight | null>(null);

  const [archived, setArchived] = useState(false);
  const archivedRef = useRef(false);

  const [canceled, setCanceled] = useState(false);
  const canceledRef = useRef(false);

  const [archivedAtISO, setArchivedAtISO] = useState<string | null>(null);
  const [canceledAtISO, setCanceledAtISO] = useState<string | null>(null);

  const [serverNowISO, setServerNowISO] = useState<string | null>(null);
  const [serverNowUtcText, setServerNowUtcText] = useState<string | null>(null);

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
    archivedRef.current = archived;
  }, [archived]);

  useEffect(() => {
    canceledRef.current = canceled;
  }, [canceled]);

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

  // ✅ clock: if archived or canceled, freeze at server snapshot
  useEffect(() => {
    if ((archived || canceled) && serverNowISO) {
      setNow(new Date(serverNowISO));
      return;
    }
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [archived, canceled, serverNowISO]);

  // ✅ shared loader via ref so polling can call it
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  // ✅ effect A: define + run loader once per token
  useEffect(() => {
    if (!token) return;

    let alive = true;

    const load = async () => {
      try {
        setError(null);

        const res = await fetch(`/api/letters/${encodeURIComponent(token)}`, { cache: "no-store" });

        // ✅ tolerate non-JSON server errors
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = { error: "Unexpected server response" };
        }

        if (!res.ok) {
          if (!alive) return;
          setError(data?.error ?? "Letter not found");
          return;
        }
        if (!alive) return;

        setServerNowISO(typeof data.server_now_iso === "string" ? data.server_now_iso : null);
        setServerNowUtcText(typeof data.server_now_utc_text === "string" ? data.server_now_utc_text : null);

        setLetter(data.letter as Letter);

        const nextArchived = !!data.archived;
        setArchived(nextArchived);

        const nextCanceled = !!data.canceled;
        setCanceled(nextCanceled);

        const aISO = (data.archived_at as string | null) || (data.letter?.archived_at as string | null) || null;
        setArchivedAtISO(aISO && String(aISO).trim() ? String(aISO) : null);

        const cISO = (data.canceled_at as string | null) || (data.letter?.canceled_at as string | null) || null;
        setCanceledAtISO(cISO && String(cISO).trim() ? String(cISO) : null);

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

    loadRef.current = load;
    void load();

    return () => {
      alive = false;
    };
  }, [token]);

  // ✅ effect B: poll ONLY when not archived/canceled
  useEffect(() => {
    if (!token) return;
    if (archived) return;
    if (canceled) return;

    const interval = setInterval(() => {
      if (archivedRef.current) return;
      if (canceledRef.current) return;
      const fn = loadRef.current;
      if (fn) void fn();
    }, 15000);

    return () => clearInterval(interval);
  }, [token, archived, canceled]);

  // Always use adjusted ETA for display + countdown
  const effectiveEtaISO = useMemo(() => {
    if (!letter) return "";
    return (letter.eta_at_adjusted && letter.eta_at_adjusted.trim()) || letter.eta_at;
  }, [letter]);

  const sleeping = !!flight?.sleeping;

  // ✅ delivered is server truth; canceled always overrides
  const uiDelivered = useMemo(() => {
    if (canceled) return false;
    return !!delivered;
  }, [canceled, delivered]);

  // ✅ progress: prefer server sleep-aware progress (it freezes when canceled)
  const progress = useMemo(() => {
    if (flight && Number.isFinite(flight.progress)) return clamp01(flight.progress);

    if (!letter) return 0;
    const sent = new Date(letter.sent_at).getTime();
    const eta = new Date(effectiveEtaISO).getTime();
    const t = now.getTime();
    if (!Number.isFinite(sent) || !Number.isFinite(eta) || eta <= sent) return 1;
    return clamp01((t - sent) / (eta - sent));
  }, [flight, letter, effectiveEtaISO, now]);

  const countdown = useMemo(() => {
    if (!letter) return "";
    const msLeft = new Date(effectiveEtaISO).getTime() - now.getTime();
    return formatCountdown(msLeft);
  }, [letter, effectiveEtaISO, now]);

  // ✅ server-provided speed wins
  const currentSpeedKmh = useMemo(() => {
    if (canceled) return 0;

    if (typeof flight?.current_speed_kmh === "number" && Number.isFinite(flight.current_speed_kmh)) {
      return Math.max(0, flight.current_speed_kmh);
    }

    if (!letter) return 0;
    if (uiDelivered || archived || sleeping) return 0;

    const sp = Number(letter.speed_kmh);
    return Number.isFinite(sp) ? sp : 0;
  }, [canceled, letter, flight?.current_speed_kmh, uiDelivered, archived, sleeping]);

  const milestones = useMemo(() => {
    if (!letter) return [];
    const defs = [
      { pct: 25, frac: 0.25, label: "25% reached" },
      { pct: 50, frac: 0.5, label: "50% reached" },
      { pct: 75, frac: 0.75, label: "75% reached" },
    ];
    return defs.map((m) => ({ ...m, isPast: progress >= m.frac }));
  }, [letter, progress]);

  const checkpointsByTime = useMemo(() => {
    const cps = [...checkpoints];
    cps.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return cps;
  }, [checkpoints]);

  const currentCheckpoint = useMemo(() => {
    if (!checkpointsByTime.length || !letter) return null;
    const t = now.getTime();
    let current: Checkpoint | null = null;
    for (const cp of checkpointsByTime) {
      if (new Date(cp.at).getTime() <= t) current = cp;
    }
    return current ?? checkpointsByTime[0];
  }, [checkpointsByTime, letter, now]);

  const secondsSinceFetch = useMemo(() => {
    if (!lastFetchedAt) return null;
    return Math.max(0, Math.floor((now.getTime() - lastFetchedAt.getTime()) / 1000));
  }, [now, lastFetchedAt]);

  const currentlyOver = useMemo(() => {
    if (canceled) return "Canceled";
    if (uiDelivered) return "Delivered";
    if (currentOverText && currentOverText.trim()) return currentOverText;

    const fallback =
      (currentCheckpoint?.geo_text && currentCheckpoint.geo_text.trim()) ||
      (currentCheckpoint?.name && currentCheckpoint.name.trim()) ||
      "somewhere over the U.S.";

    return fallback;
  }, [canceled, uiDelivered, currentOverText, currentCheckpoint]);

  const mapTooltip = useMemo(() => {
    if (flight?.tooltip_text && flight.tooltip_text.trim()) return flight.tooltip_text;
    if (canceled) return "Location: Canceled";
    if (uiDelivered) return "Location: Delivered";
    return `Location: ${currentlyOver || "somewhere over the U.S."}`;
  }, [flight?.tooltip_text, canceled, uiDelivered, currentlyOver]);

  const showLive = !archived && !canceled && !uiDelivered;

  // ✅ NEW: final timeline state
  const timelineFinal = uiDelivered || archived || canceled;

  // ✅ Build timeline + add Delivered card
  const timelineItems = useMemo(() => {
    const base: TimelineItem[] = checkpointsByTime.map((cp) => ({
      key: `cp-${cp.id}`,
      name: cp.name,
      at: cp.at,
      kind: isSleepCheckpoint(cp) ? "sleep" : "checkpoint",
    }));

    // ✅ Add a final delivered row (distinct tint)
    if (uiDelivered && !canceled) {
      base.push({
        key: "delivered",
        name: "Delivered ✅",
        at: effectiveEtaISO || new Date().toISOString(),
        kind: "delivered",
      });
    }

    const grouped: TimelineItem[] = [];
    let lastDay = "";

    for (const it of base) {
      const d = dayLabelLocal(it.at);
      if (d && d !== lastDay) {
        grouped.push({
          key: `day-${d}`,
          name: d,
          at: it.at,
          kind: "day",
        });
        lastDay = d;
      }
      grouped.push(it);
    }

    return grouped;
  }, [checkpointsByTime, uiDelivered, canceled, effectiveEtaISO]);

  const currentTimelineKey = useMemo(() => {
    if (uiDelivered || canceled) return null;

    const realItems = timelineItems.filter((it) => it.kind !== "day");
    if (!realItems.length) return null;

    const nowT = now.getTime();
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
  }, [timelineItems, now, uiDelivered, canceled]);

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

  // ✅ marker mode: force canceled if canceled
  const markerMode: Flight["marker_mode"] = useMemo(() => {
    if (canceled) return "canceled";
    if (flight?.marker_mode) return flight.marker_mode;
    return uiDelivered ? "delivered" : sleeping ? "sleeping" : "flying";
  }, [canceled, flight?.marker_mode, uiDelivered, sleeping]);

  // ✅ confetti/reveal: only for real delivery (never canceled)
  useEffect(() => {
    if (canceled) return;

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
  }, [uiDelivered, canceled]);

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

  const bird = inferBird(letter);
  const birdName = birdLabel(bird);

  const archivedLabel = archivedAtISO ? `Archived • ${new Date(archivedAtISO).toLocaleString()}` : "Archived";
  const canceledLabel = canceledAtISO ? `Canceled • ${new Date(canceledAtISO).toLocaleString()}` : "Canceled";

  // ✅ pill label improved
  const timelineModeLabel = uiDelivered ? "Delivered" : canceled ? "Canceled" : archived ? "Archived" : "Auto";

  return (
    <main className="pageBg">
      <main className="wrap">
        <section className="routeBanner">
          <div className="bannerTop">
            <div>
              <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  }}
>
  <a
    href="/"
    aria-label="FLOK home"
    title="Home"
    className="flokMarkLink"
    style={{ padding: 4 }}
  >
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/brand/flok-mark.png"
      alt="FLOK"
      className="flokMark"
    />
  </a>

  <div className="kicker" style={{ margin: 0 }}>
    Flight status
  </div>
</div>

              <div className="routeHeadline">
                {letter.origin_name} <span className="arrow">→</span> {letter.dest_name}
              </div>

              <div className="subRow">
                <BirdStatusCard bird={bird} mode={markerMode} wakeText={flight?.sleep_local_text || undefined} />

                {showLive ? (
                  <>
                    <div className="liveStack" style={{ minWidth: 230, flex: "0 0 auto" }}>
                      <div className={`liveWrap ${sleeping ? "sleep" : ""}`}>
                        {sleeping ? (
                          <span className="ico" style={{ marginRight: 8 }}>
                            <Ico name="moon" size={14} />
                          </span>
                        ) : (
                          <span className={`liveDot ${sleeping ? "sleep" : ""}`} />
                        )}
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
                ) : canceled ? (
                  <div className="metaPill" style={{ borderColor: "rgba(220,38,38,0.35)", background: "rgba(220,38,38,0.06)" }}>
                    <span className="ico" style={{ color: "rgb(220,38,38)" }}>
                      <Ico name="x" />
                    </span>
                    <span>
                      <strong>CANCELED</strong> — recalled. <span style={{ opacity: 0.75 }}>{canceledLabel}</span>
                    </span>
                  </div>
                ) : archived ? (
                  <div className="metaPill">
                    <span className="ico">
                      <Ico name="timeline" />
                    </span>
                    <span>
                      <strong>ARCHIVED</strong> — snapshot view. <span style={{ opacity: 0.75 }}>{archivedLabel}</span>
                    </span>
                  </div>
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

              {!uiDelivered && !archived && !canceled && <div className="etaSub">T-minus {countdown}</div>}

              {(archived || canceled) && (
                <div className="etaSub">
                  Snapshot: <span style={{ fontVariantNumeric: "tabular-nums" }}>{serverNowUtcText ?? "frozen"}</span>
                </div>
              )}
            </div>
          </div>

          <div className="statsRow">
            <div className="stat">
              <span className="ico">
                <Ico name="distance" />
              </span>
              <div>
                <div className="statLabel">Distance</div>
                <div className="statValue">{Number(letter.distance_km).toFixed(0)} km</div>
              </div>
            </div>

            <div className="stat">
              <span className="ico">
                <Ico name="speed" />
              </span>
              <div>
                <div className="statLabel">Speed</div>
                <div className="statValue">{Number(currentSpeedKmh).toFixed(0)} km/h</div>
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
              <span>{canceled ? "Canceled" : "Sealed until delivery"}</span>
            </div>
          </div>

          <div className="soft">
            <div className="subject">{letter.subject || "(No subject)"}</div>

            <div style={{ position: "relative" }}>
              <div className={uiDelivered && revealStage === "open" ? "bodyReveal" : ""} style={{ opacity: uiDelivered && !canceled ? 1 : 0 }}>
                <div className="body">{uiDelivered && !canceled ? (letter.body ?? "") : ""}</div>
              </div>

              {uiDelivered && !canceled && revealStage === "open" ? null : (
                <div style={{ position: uiDelivered && !canceled ? "absolute" : "relative", inset: 0 }}>
                  <WaxSealOverlay etaText={etaTextUTC} cracking={uiDelivered && revealStage === "crack"} canceled={canceled} />
                </div>
              )}
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

                <div className="pillBtn subtle" title="Timeline mode">
                  <span className="ico">
                    <Ico name="live" />
                  </span>
                  {timelineModeLabel}
                </div>
              </div>

              <RailTimeline items={timelineItems} now={now} currentKey={currentTimelineKey} birdName={birdName} final={timelineFinal} />
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

                        {b.subtitle ? <div className="muted" style={{ marginTop: 4 }}>{b.subtitle}</div> : null}
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