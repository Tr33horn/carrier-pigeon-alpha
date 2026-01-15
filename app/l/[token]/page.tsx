"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import TimelineRail from "./_components/TimelineRail";
import { buildTimelineItems, pickCurrentTimelineKey } from "./_lib/letterStatusTimeline";
import MapSection from "./_components/MapSection";

import { BIRD_RULES, normalizeBird } from "@/app/lib/birds";

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
  speed_kmh: number; // legacy (we no longer trust this for bird rules)
  sent_at: string;
  eta_at: string;

  bird?: "pigeon" | "snipe" | "goose" | null;

  eta_at_adjusted?: string;
  eta_utc_text?: string;

  archived_at?: string | null;
  canceled_at?: string | null;

  // ✅ NEW: seal id returned by API
  seal_id?: string | null;
};

type Checkpoint = {
  id: string;
  idx: number;
  name: string;
  at: string;
  geo_text?: string;
  kind?: "checkpoint" | "sleep";
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

type MapStyle = "carto-positron" | "carto-voyager" | "carto-positron-nolabels" | "ink-sketch";
type BirdType = "pigeon" | "snipe" | "goose";

/* ------------------- helpers ------------------- */

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function clampMs(t: number, a: number, b: number) {
  return Math.max(a, Math.min(b, t));
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

/** Local time formatter for display (full) */
function formatLocal(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

/** UTC formatter for display (full, explicit UTC) */
function formatUtc(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
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

/** Back-compat name */
function formatUtcFallback(iso: string) {
  return formatUtc(iso);
}

/** ✅ Short, nice-looking “Opens at …” line */
function formatOpensShort(etaIso: string) {
  const dLocal = new Date(etaIso);
  const dUtc = new Date(etaIso);
  if (!Number.isFinite(dLocal.getTime())) return "";

  const now = new Date();

  const sameDayLocal =
    dLocal.getFullYear() === now.getFullYear() &&
    dLocal.getMonth() === now.getMonth() &&
    dLocal.getDate() === now.getDate();

  const timeLocal = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(dLocal);

  const timeUtc = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(dUtc);

  if (sameDayLocal) return `${timeLocal} (${timeUtc} UTC)`;

  const dateLocal = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(dLocal);

  const dateUtc = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(dUtc);

  return `${dateLocal}, ${timeLocal} (${dateUtc}, ${timeUtc} UTC)`;
}

/**
 * ✅ Robust seal resolver
 * API may return: seal_flokheart
 * file may be:     seal-flokheart.png
 */
function sealImageSrcs(sealId: string | null | undefined): string[] {
  const raw = typeof sealId === "string" ? sealId.trim() : "";
  const urls: string[] = [];

  const push = (u: string) => {
    if (!u) return;
    if (!urls.includes(u)) urls.push(u);
  };

  if (!raw) {
    push("/waxseal.png");
    return urls;
  }

  if (raw.toLowerCase().endsWith(".png")) {
    push(`/seals/${encodeURIComponent(raw)}`);
    push("/waxseal.png");
    return urls;
  }

  push(`/seals/${encodeURIComponent(raw)}.png`);
  push(`/seals/${encodeURIComponent(raw.replace(/_/g, "-"))}.png`);
  push(`/seals/${encodeURIComponent(raw.replace(/-/g, "_"))}.png`);

  if (raw.startsWith("seal_")) push(`/seals/${encodeURIComponent(raw.replace(/^seal_/, "seal-"))}.png`);
  if (raw.startsWith("seal-")) push(`/seals/${encodeURIComponent(raw.replace(/^seal-/, "seal_"))}.png`);

  if (!raw.startsWith("seal-") && !raw.startsWith("seal_")) {
    push(`/seals/${encodeURIComponent(`seal-${raw}`)}.png`);
    push(`/seals/${encodeURIComponent(`seal_${raw}`)}.png`);
  }

  const squashed = raw.replace(/[-_]/g, "");
  if (squashed !== raw) {
    push(`/seals/${encodeURIComponent(squashed)}.png`);
    push(`/seals/${encodeURIComponent(`seal-${squashed}`)}.png`);
    push(`/seals/${encodeURIComponent(`seal_${squashed}`)}.png`);
  }

  push("/waxseal.png");
  return urls;
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
          <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 14.2A7.5 7.5 0 0 1 9.8 3a6.6 6.6 0 1 0 11.2 11.2Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M12 10.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z" stroke="currentColor" strokeWidth="2.4" />
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
          <path d="M9 9l-2-2 2-2M15 15l2 2-2 2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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
    <a href="/new" className="birdStatusCard" style={{ textDecoration: "none", color: "inherit" }} title="Choose a bird">
      <div className="birdStatusRow" style={{ cursor: "pointer" }}>
        <div className={`birdStatusThumb ${mode}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${bird} bird`} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="birdStatusTitle">{BIRD_RULES[bird].label}</div>
          <div className="muted" style={{ marginTop: 2 }}>
            {label}
          </div>
        </div>
      </div>
    </a>
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

/* ---------- wax seal overlay (click-to-open) ---------- */
function WaxSealOverlay({
  opensShort,
  cracking,
  canceled,
  canOpen,
  onOpen,
  sealSrcs,
}: {
  opensShort: string;
  cracking?: boolean;
  canceled?: boolean;
  canOpen?: boolean;
  onOpen?: () => void;
  sealSrcs: string[];
}) {
  const [idx, setIdx] = useState(0);
  const sealSrc = sealSrcs[idx] || "/waxseal.png";

  useEffect(() => {
    setIdx(0);
  }, [sealSrcs.join("|")]);

  return (
    <div className={cracking ? "seal crack" : "seal"} style={{ position: "relative" }}>
      <div className="sealCard">
        <div className="sealVeil" />

        <div className="sealRow">
          <button
            type="button"
            className={`waxBtn ${canOpen ? "canOpen" : ""}`}
            onClick={() => {
              if (!canOpen) return;
              onOpen?.();
            }}
            disabled={!canOpen}
            aria-label={canOpen ? "Open letter" : "Sealed until delivery"}
            title={canOpen ? "Open letter" : "Sealed until delivery"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sealSrc}
              alt="Wax seal"
              className="waxImg"
              onError={() => setIdx((n) => Math.min(n + 1, sealSrcs.length - 1))}
            />
            {canOpen ? <div className="waxHint">Click to open</div> : null}
          </button>

          <div>
            <div className="sealTitle">{canceled ? "Canceled" : canOpen ? "Delivered" : "Sealed until delivery"}</div>
            <div className="sealSub">
              {canceled ? "This letter will not be delivered." : canOpen ? "Tap the wax seal to read it." : `Opens at ${opensShort}`}
            </div>
            <div className="sealHint">
              {canceled ? "The bird was recalled to HQ." : canOpen ? "Go on. Break the seal." : "No peeking. The bird is watching."}
            </div>
          </div>
        </div>

        <div className="sealNoise" />
      </div>
    </div>
  );
}

/* ---------- modal (paper-unfold) ---------- */
function LetterModal({
  open,
  onClose,
  title,
  subject,
  body,
  confetti,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subject: string;
  body: string;
  confetti: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="letterModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Letter"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="letterModalCard">
        <ConfettiBurst show={confetti} />

        <div className="letterModalTop">
          <div style={{ minWidth: 0 }}>
            <div className="kicker" style={{ margin: 0 }}>
              Letter
            </div>
            <div className="h2" style={{ marginTop: 4 }}>
              {title}
            </div>
          </div>

          <button className="letterModalClose" onClick={onClose} aria-label="Close">
            <Ico name="x" size={18} />
          </button>
        </div>

        <div className="paperWrap">
          <div className="paperSheet" role="document" aria-label="Letter contents">
            <div className="paperSubject">{subject || "(No subject)"}</div>
            <div className="paperBody">{body || ""}</div>
          </div>
        </div>
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
  const params = useParams() as Record<string, string | string[] | undefined>;

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

  const deliveredRef = useRef(false);

  const [archivedAtISO, setArchivedAtISO] = useState<string | null>(null);
  const [canceledAtISO, setCanceledAtISO] = useState<string | null>(null);

  const [serverNowISO, setServerNowISO] = useState<string | null>(null);
  const [serverNowUtcText, setServerNowUtcText] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [delivered, setDelivered] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const [currentOverText, setCurrentOverText] = useState<string | null>(null);

  const [letterOpen, setLetterOpen] = useState(false);
  const [sealCracking, setSealCracking] = useState(false);
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

    if (saved === "carto-positron" || saved === "carto-voyager" || saved === "carto-positron-nolabels" || saved === "ink-sketch") {
      setMapStyle(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("pigeon_map_style", mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    if ((archived || canceled) && serverNowISO) {
      setNow(new Date(serverNowISO));
      return;
    }
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [archived, canceled, serverNowISO]);

  useEffect(() => {
    if (!letterOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLetterOpen(false);
    };
    window.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [letterOpen]);

  const loadRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!token) return;

    let alive = true;

    const load = async () => {
      try {
        setError(null);

        const res = await fetch(`/api/letters/${encodeURIComponent(token)}`, { cache: "no-store" });

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

  const effectiveEtaISO = useMemo(() => {
    if (!letter) return "";
    return (letter.eta_at_adjusted && letter.eta_at_adjusted.trim()) || letter.eta_at;
  }, [letter]);

  const sentMs = useMemo(() => parseMs(letter?.sent_at) ?? null, [letter?.sent_at]);
  const etaMs = useMemo(() => parseMs(effectiveEtaISO) ?? null, [effectiveEtaISO]);

  const checkpointsAdjusted = useMemo(() => {
    if (!checkpoints.length) return [];
    if (sentMs == null || etaMs == null) return checkpoints.map((c) => ({ ...c, _atAdj: c.at }));

    const lo = Math.min(sentMs, etaMs);
    const hi = Math.max(sentMs, etaMs);

    return checkpoints.map((c) => {
      const t = parseMs(c.at);
      if (t == null) return { ...c, _atAdj: c.at };
      const clamped = clampMs(t, lo, hi);
      return { ...c, _atAdj: new Date(clamped).toISOString() };
    });
  }, [checkpoints, sentMs, etaMs]);

  const sleeping = !!flight?.sleeping;

  const uiDelivered = useMemo(() => {
    if (canceled) return false;
    return !!delivered;
  }, [canceled, delivered]);

  useEffect(() => {
    deliveredRef.current = uiDelivered;
  }, [uiDelivered]);

  useEffect(() => {
    if (!token) return;
    if (archived) return;
    if (canceled) return;
    if (uiDelivered) return;

    const interval = setInterval(() => {
      if (archivedRef.current) return;
      if (canceledRef.current) return;
      if (deliveredRef.current) return;

      const fn = loadRef.current;
      if (fn) void fn();
    }, 15000);

    return () => clearInterval(interval);
  }, [token, archived, canceled, uiDelivered]);

  const progress = useMemo(() => {
    if (flight && Number.isFinite(flight.progress)) return clamp01(flight.progress);

    if (!letter) return 0;
    const sent = new Date(letter.sent_at).getTime();
    const eta = new Date(effectiveEtaISO).getTime();
    const t = now.getTime();
    if (!Number.isFinite(sent) || !Number.isFinite(eta) || eta <= sent) return 1;
    return clamp01((t - sent) / (eta - sent));
  }, [flight, letter, effectiveEtaISO, now]);

  const progressPctFloor = useMemo(() => {
    if (!Number.isFinite(progress)) return 0;
    return Math.max(0, Math.min(100, Math.floor(progress * 100)));
  }, [progress]);

  const countdown = useMemo(() => {
    if (!letter) return "";
    const msLeft = new Date(effectiveEtaISO).getTime() - now.getTime();
    return formatCountdown(msLeft);
  }, [letter, effectiveEtaISO, now]);

  const bird: BirdType = useMemo(() => normalizeBird(letter?.bird), [letter?.bird]);
  const birdName = useMemo(() => BIRD_RULES[bird].label, [bird]);

  const currentSpeedKmh = useMemo(() => {
    if (canceled) return 0;
    if (!letter) return 0;
    if (uiDelivered || archived || sleeping) return 0;

    if (typeof flight?.current_speed_kmh === "number" && Number.isFinite(flight.current_speed_kmh)) {
      return Math.max(0, flight.current_speed_kmh);
    }

    return Number.isFinite(BIRD_RULES[bird]?.speedKmh) ? BIRD_RULES[bird].speedKmh : 0;
  }, [canceled, letter, uiDelivered, archived, sleeping, flight?.current_speed_kmh, bird]);

  // ✅ CHANGE #1: milestones labels (no "reached" + no bullets from us)
  const milestones = useMemo(() => {
    if (!letter) return [];
    const defs = [
      { pct: 25, label: "25%" },
      { pct: 50, label: "50%" },
      { pct: 75, label: "75%" },
    ];
    return defs.map((m) => ({ ...m, isPast: progressPctFloor >= m.pct }));
  }, [letter, progressPctFloor]);

  const checkpointsByTime = useMemo(() => {
    const cps = [...checkpointsAdjusted];
    cps.sort((a: any, b: any) => Date.parse(a._atAdj || a.at) - Date.parse(b._atAdj || b.at));
    return cps;
  }, [checkpointsAdjusted]);

  const currentCheckpoint = useMemo(() => {
    if (!checkpointsByTime.length || !letter) return null;
    const tNow = now.getTime();
    let current: any = null;

    for (const cp of checkpointsByTime as any[]) {
      const atISO = cp._atAdj || cp.at;
      if (new Date(atISO).getTime() <= tNow) current = cp;
    }

    return current ?? (checkpointsByTime as any[])[0];
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
      (currentCheckpoint?.geo_text && String(currentCheckpoint.geo_text).trim()) ||
      (currentCheckpoint?.name && String(currentCheckpoint.name).trim()) ||
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
  const timelineFinal = uiDelivered || archived || canceled;

  const timelineItems = useMemo(() => {
    if (!letter) return [];
    return buildTimelineItems({
      now,
      letter,
      checkpointsByTime,
      timelineFinal,
      uiDelivered,
      canceled,
      effectiveEtaISO,
    });
  }, [now, letter, checkpointsByTime, timelineFinal, uiDelivered, canceled, effectiveEtaISO]);

  const currentTimelineKey = useMemo(() => {
    return pickCurrentTimelineKey({
      items: timelineItems,
      now,
      sleeping,
      uiDelivered,
      canceled,
    });
  }, [timelineItems, now, sleeping, uiDelivered, canceled]);

  const etaTextUTC = useMemo(() => {
    if (!letter) return "";
    return (letter.eta_utc_text && letter.eta_utc_text.trim()) || formatUtcFallback(effectiveEtaISO);
  }, [letter, effectiveEtaISO]);

  const etaTextLocal = useMemo(() => {
    if (!letter) return "";
    return formatLocal(effectiveEtaISO);
  }, [letter, effectiveEtaISO]);

  const opensShort = useMemo(() => {
    if (!effectiveEtaISO) return "";
    return formatOpensShort(effectiveEtaISO);
  }, [effectiveEtaISO]);

  const badgesSorted = useMemo(() => {
    const b = items.badges ?? [];
    return [...b].sort((a, c) => {
      const ta = a.earned_at ? Date.parse(a.earned_at) : 0;
      const tb = c.earned_at ? Date.parse(c.earned_at) : 0;
      return ta - tb;
    });
  }, [items.badges]);

  const markerMode: Flight["marker_mode"] = useMemo(() => {
    if (canceled) return "canceled";
    if (flight?.marker_mode) return flight.marker_mode;
    return uiDelivered ? "delivered" : sleeping ? "sleeping" : "flying";
  }, [canceled, flight?.marker_mode, uiDelivered, sleeping]);

  const sealSrcs = useMemo(() => sealImageSrcs(letter?.seal_id ?? null), [letter?.seal_id]);

  function openLetter() {
    if (!uiDelivered || canceled) return;

    setSealCracking(true);
    setConfetti(true);

    window.setTimeout(() => setLetterOpen(true), 220);
    window.setTimeout(() => setSealCracking(false), 650);
    window.setTimeout(() => setConfetti(false), 1400);
  }

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

  const archivedLabel = archivedAtISO ? `Archived • ${new Date(archivedAtISO).toLocaleString()}` : "Archived";
  const canceledLabel = canceledAtISO ? `Canceled • ${new Date(canceledAtISO).toLocaleString()}` : "Canceled";

  const timelineModeLabel = uiDelivered ? "Delivered" : canceled ? "Canceled" : archived ? "Archived" : "Auto";
  const modalTitle = `From ${letter.from_name || "Sender"} to ${letter.to_name || "Recipient"}`;

  return (
    <main className="pageBg">
      <main className="wrap">
        <section className="routeBanner">
          <div className="bannerTop">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <a href="/" aria-label="FLOK home" title="Home" className="flokMarkLink" style={{ padding: 4 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/flok-mark.png" alt="FLOK" className="flokMark" />
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
              <div className="kicker">ETA</div>
              <div className="etaTime">{etaTextLocal}</div>
              <div className="etaSub" style={{ opacity: 0.75 }}>
                (UTC: {etaTextUTC})
              </div>

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
                <div className="statValue">{progressPctFloor}%</div>
              </div>
            </div>
          </div>
        </section>

        {/* ✅ Letter (40%) + Map (60%) side-by-side, Timeline beneath both */}
        <div className="statusGrid">
          {/* LEFT: Letter (40%) */}
          <div className="statusCol">
            <div className="card letterCard" style={{ position: "relative" }}>
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
                  <span>{canceled ? "Canceled" : uiDelivered ? "Delivered" : "Sealed until delivery"}</span>
                </div>
              </div>

              <div className="soft">
                <div className="subject">{letter.subject || "(No subject)"}</div>

                <div style={{ position: "relative" }}>
                  <WaxSealOverlay
                    opensShort={opensShort}
                    cracking={sealCracking}
                    canceled={canceled}
                    canOpen={uiDelivered && !canceled}
                    onOpen={openLetter}
                    sealSrcs={sealSrcs}
                  />
                </div>
              </div>

              <div className="token">Token: {letter.public_token}</div>
            </div>
          </div>

          {/* RIGHT: Map (60%) */}
          <div className="statusCol">
            <div className="card">
              <MapSection
                mapStyle={mapStyle}
                setMapStyle={setMapStyle}
                origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
                dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
                progress={progress}
                progressPctFloor={progressPctFloor}
                tooltipText={mapTooltip}
                markerMode={markerMode}
                showLive={showLive}
                sentAtISO={letter.sent_at}
                etaAtISO={effectiveEtaISO}
                currentlyOver={currentlyOver}
                milestones={milestones}
              />
            </div>
          </div>

          {/* FULL WIDTH: Timeline */}
          <div className="statusFull">
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

              <TimelineRail items={timelineItems} now={now} currentKey={currentTimelineKey} birdName={birdName} final={timelineFinal} />
            </div>
          </div>

          {/* FULL WIDTH: Badges */}
          <div className="statusFull">
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

        {/* Modal */}
        <LetterModal
          open={letterOpen}
          onClose={() => setLetterOpen(false)}
          title={modalTitle}
          subject={letter.subject || ""}
          body={letter.body || ""}
          confetti={confetti}
        />
      </main>

      {/* ✅ Scoped layout CSS (Map 60% / Letter 40%) */}
      <style jsx>{`
        .statusGrid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: start;
        }

        /* Make the two top columns equal height */
        .statusCol {
          height: 100%;
          min-width: 0; /* prevents overflow weirdness */
        }

        /* Make the cards inside those columns fill the column height */
        .statusCol > :global(.card) {
          height: 100%;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        /* Let the map area stretch */
        .statusCol > :global(.card) :global(.mapWrap),
        .statusCol > :global(.card) :global(.mapFrame),
        .statusCol > :global(.card) :global(.mapContainer) {
          flex: 1 1 auto;
          min-height: 0;
        }

        /* Desktop: Letter 40% (left) / Map 60% (right) */
        @media (min-width: 980px) {
          .statusGrid {
            grid-template-columns: 0.8fr 1.2fr; /* 40/60 */
            gap: 14px;
          }
          .statusFull {
            grid-column: 1 / -1;
          }
        }

        @media (min-width: 1280px) {
          .statusGrid {
            gap: 16px;
          }
        }
      `}</style>
    </main>
  );
}