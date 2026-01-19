"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import TimelineRail, { type TimelineItem } from "./_components/TimelineRail";
import { buildTimelineItems, pickCurrentTimelineKey } from "./_lib/letterStatusTimeline";
import MapSection from "./_components/MapSection";

import { BIRD_RULES, normalizeBird } from "@/app/lib/birds";
import { getEnvelopeTintColor, normalizeEnvelopeTint } from "@/app/lib/envelopeTints";

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
  envelope_tint?: string | null;
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
  iconSrc?: string | null;
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
type IconName = "live" | "pin" | "speed" | "distance" | "check" | "mail" | "timeline" | "moon" | "x";
type FlightState = "in_flight" | "arriving" | "delivered";

type StatusPillConfig = {
  icon: IconName;
  label: string;
  detail: string;
  trailing?: string;
  style?: CSSProperties;
  iconStyle?: CSSProperties;
};

type PageLayout = {
  state: FlightState;
  gridMode: "default" | "delivered_stack";
  columns: { letter: string; map: string };
  letterHeight: string;
  mapHeight: string;
  mapPrimary: boolean;
  letterPrimary: boolean;
  mapDesaturate: boolean;
  showLiveBadge: boolean;
  liveLabel: string;
  liveBadge?: { label: string; subLabel: string; indicator: "moon" | "dot" } | null;
  showLocationPill: boolean;
  showCountdown: boolean;
  showSnapshot: boolean;
  letterStatusLabel: string;
  canOpenLetter: boolean;
  showSpeed: boolean;
  timelineTitle: string;
  timelineModeLabel: string;
  timelineFinal: boolean;
  highlightLatestTimeline: boolean;
  collapseTimeline: boolean;
  waxPulse: boolean;
  statusPill?: StatusPillConfig | null;
};

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

function isWithinSleepWindow(date: Date, startHour = 22, endHour = 6) {
  if (!Number.isFinite(date.getTime())) return false;
  if (startHour === endHour) return false;
  const h = date.getHours();
  if (startHour < endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}

function pickNightLine(seedString: string) {
  const lines = [
    "Flying under night skies",
    "Still flying. Even now.",
    "The long way, quietly.",
    "Moving while the world sleeps.",
  ];

  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash * 31 + seedString.charCodeAt(i)) >>> 0;
  }
  return lines[hash % lines.length];
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
  name: IconName;
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

const ARRIVING_PROGRESS_THRESHOLD = 0.97;



function getPageLayout(state: FlightState): PageLayout {
  if (state === "delivered") {
    return {
      state,
      gridMode: "delivered_stack",
      columns: { letter: "7fr", map: "5fr" },
      letterHeight: "420px",
      mapHeight: "300px",
      mapPrimary: false,
      letterPrimary: true,
      mapDesaturate: true,
      showLiveBadge: false,
      liveLabel: "LIVE",
      showLocationPill: false,
      showCountdown: false,
      showSnapshot: false,
      letterStatusLabel: "Delivered",
      canOpenLetter: true,
      showSpeed: false,
      timelineTitle: "Flight story",
      timelineModeLabel: "Delivered",
      timelineFinal: true,
      highlightLatestTimeline: false,
      collapseTimeline: true,
      waxPulse: false,
      statusPill: {
        icon: "check",
        label: "Delivered",
        detail: "the bird has clocked out.",
      },
    };
  }

  if (state === "arriving") {
    return {
      state,
      gridMode: "default",
      columns: { letter: "5fr", map: "7fr" },
      letterHeight: "360px",
      mapHeight: "380px",
      mapPrimary: true,
      letterPrimary: false,
      mapDesaturate: false,
      showLiveBadge: true,
      liveLabel: "ARRIVING",
      showLocationPill: true,
      showCountdown: true,
      showSnapshot: false,
      letterStatusLabel: "Sealed until delivery",
      canOpenLetter: false,
      showSpeed: true,
      timelineTitle: "Flight log",
      timelineModeLabel: "Auto",
      timelineFinal: false,
      highlightLatestTimeline: true,
      collapseTimeline: false,
      waxPulse: true,
      statusPill: null,
    };
  }

  return {
    state: "in_flight",
    gridMode: "default",
    columns: { letter: "5fr", map: "7fr" },
    letterHeight: "360px",
    mapHeight: "380px",
    mapPrimary: false,
    letterPrimary: false,
    mapDesaturate: false,
    showLiveBadge: true,
    liveLabel: "LIVE",
    showLocationPill: true,
    showCountdown: true,
    showSnapshot: false,
    letterStatusLabel: "Sealed until delivery",
    canOpenLetter: false,
    showSpeed: true,
    timelineTitle: "Flight log",
    timelineModeLabel: "Auto",
    timelineFinal: false,
    highlightLatestTimeline: false,
    collapseTimeline: false,
    waxPulse: false,
    statusPill: null,
  };
}

function collapseTimelineItems(items: TimelineItem[]) {
  if (!items.length) return items;

  const out: TimelineItem[] = [];
  let lastNonDay: TimelineItem | null = null;

  for (const it of items) {
    if (it.kind === "day") {
      out.push(it);
      lastNonDay = null;
      continue;
    }
    if (lastNonDay && lastNonDay.kind === it.kind && lastNonDay.name === it.name) continue;
    out.push(it);
    lastNonDay = it;
  }

  const trimmed: TimelineItem[] = [];
  for (let i = 0; i < out.length; i++) {
    const it = out[i];
    if (it.kind === "day") {
      const next = out[i + 1];
      if (!next || next.kind === "day") continue;
    }
    trimmed.push(it);
  }

  return trimmed;
}

function pickTimelineTail(items: TimelineItem[], count = 3) {
  if (!items.length) return items;

  const target: number[] = [];
  for (let i = items.length - 1; i >= 0 && target.length < count; i--) {
    if (items[i].kind !== "day") target.push(i);
  }

  if (!target.length) return items;

  const include = new Set<number>();
  for (const idx of target) {
    include.add(idx);
    for (let j = idx - 1; j >= 0; j--) {
      if (items[j].kind === "day") {
        include.add(j);
        break;
      }
    }
  }

  return items.filter((_, i) => include.has(i));
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
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setResolvedSrc(null);

    const candidates = [...sealSrcs, "/waxseal.png"];

    const resolve = async () => {
      for (const candidate of candidates) {
        const loaded = await new Promise<boolean>((done) => {
          const img = new Image();
          img.onload = () => done(true);
          img.onerror = () => done(false);
          img.src = candidate;
        });
        if (!alive) return;
        if (loaded) {
          setResolvedSrc(candidate);
          return;
        }
      }
      if (!alive) return;
      setResolvedSrc("/waxseal.png");
    };

    void resolve();
    return () => {
      alive = false;
    };
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
            {resolvedSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolvedSrc} alt="Wax seal" className="waxImg" />
            ) : (
              <div className="waxImgLoading" aria-hidden />
            )}
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
  envelopeTintColor,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subject: string;
  body: string;
  confetti: boolean;
  envelopeTintColor: string;
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
          <div
            className="paperSheet"
            role="document"
            aria-label="Letter contents"
            style={{ ["--env-tint" as any]: envelopeTintColor }}
          >
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
  const [serverNowCapturedAtMs, setServerNowCapturedAtMs] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [delivered, setDelivered] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const [currentOverText, setCurrentOverText] = useState<string | null>(null);

  const [letterOpen, setLetterOpen] = useState(false);
  const [sealCracking, setSealCracking] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const deliveredConfettiRef = useRef(false);

  const [mapStyle, setMapStyle] = useState<MapStyle>("carto-voyager");

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

        const nextServerNowISO = typeof data.server_now_iso === "string" ? data.server_now_iso : null;
        setServerNowISO(nextServerNowISO);
        setServerNowCapturedAtMs(nextServerNowISO ? Date.now() : null);
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

  const markerMode: Flight["marker_mode"] = useMemo(() => {
    if (canceled) return "canceled";
    if (flight?.marker_mode) return flight.marker_mode;
    if (uiDelivered || progress >= 1) return "delivered";
    return sleeping ? "sleeping" : "flying";
  }, [canceled, flight?.marker_mode, uiDelivered, progress, sleeping]);

  const deliveredState = uiDelivered || progress >= 1 || markerMode === "delivered";

  const flightState: FlightState = deliveredState
    ? "delivered"
    : progress >= ARRIVING_PROGRESS_THRESHOLD
    ? "arriving"
    : "in_flight";

  const sentAtDate = useMemo(() => {
    if (!letter?.sent_at) return null;
    const d = new Date(letter.sent_at);
    return Number.isFinite(d.getTime()) ? d : null;
  }, [letter?.sent_at]);

  const sentAtInSleepWindow = useMemo(() => {
    if (!sentAtDate) return false;
    return isWithinSleepWindow(sentAtDate);
  }, [sentAtDate]);

  const nightSeed = letter?.public_token || letter?.sent_at || "";
  const nightLine = useMemo(() => pickNightLine(nightSeed), [nightSeed]);
  const inSleepHoursNow = useMemo(() => isWithinSleepWindow(now), [now]);
  const nightFlightExceptionActive =
    sentAtInSleepWindow && !sleeping && !canceled && !archived && !deliveredState;

  const countdown = useMemo(() => {
    if (!letter) return null;
    if (flightState === "delivered" || canceled || archived) return null;
    const etaMsLocal = Date.parse(effectiveEtaISO);
    const authoritativeNowMs =
      serverNowISO && serverNowCapturedAtMs
        ? Date.parse(serverNowISO) + (now.getTime() - serverNowCapturedAtMs)
        : now.getTime();
    const msLeft = etaMsLocal - authoritativeNowMs;
    if (!Number.isFinite(msLeft)) return null;
    if (msLeft > 24 * 60 * 60 * 1000) return null;
    return formatCountdown(Math.max(0, msLeft));
  }, [letter, effectiveEtaISO, now, flightState, canceled, archived, serverNowISO, serverNowCapturedAtMs]);

  const wakeCountdown = useMemo(() => {
    if (!sleeping || !flight?.sleep_until_iso) return null;
    const wakeMs = Date.parse(flight.sleep_until_iso);
    if (!Number.isFinite(wakeMs)) return null;
    const authoritativeNowMs =
      serverNowISO && serverNowCapturedAtMs
        ? Date.parse(serverNowISO) + (now.getTime() - serverNowCapturedAtMs)
        : now.getTime();
    const msLeft = wakeMs - authoritativeNowMs;
    if (!Number.isFinite(msLeft)) return null;
    return formatCountdown(Math.max(0, msLeft));
  }, [sleeping, flight?.sleep_until_iso, now, serverNowISO, serverNowCapturedAtMs]);

  const debugLoggedRef = useRef(false);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (debugLoggedRef.current) return;
    if (!effectiveEtaISO) return;
    const authoritativeNowMs =
      serverNowISO && serverNowCapturedAtMs
        ? Date.parse(serverNowISO) + (Date.now() - serverNowCapturedAtMs)
        : Date.now();
    const msLeft = Date.parse(effectiveEtaISO) - authoritativeNowMs;
    const authoritativeNowISO = Number.isFinite(authoritativeNowMs) ? new Date(authoritativeNowMs).toISOString() : null;
    console.log({
      serverNowISO,
      authoritativeNowISO,
      effectiveEtaISO,
      msLeft,
    });
    debugLoggedRef.current = true;
  }, [effectiveEtaISO, serverNowISO, serverNowCapturedAtMs]);

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
    if (deliveredState) return "Delivered";
    if (currentOverText && currentOverText.trim()) return currentOverText;

    const fallback =
      (currentCheckpoint?.geo_text && String(currentCheckpoint.geo_text).trim()) ||
      (currentCheckpoint?.name && String(currentCheckpoint.name).trim()) ||
      "somewhere over the U.S.";

    return fallback;
  }, [canceled, deliveredState, currentOverText, currentCheckpoint]);

  const mapTooltip = useMemo(() => {
    if (flight?.tooltip_text && flight.tooltip_text.trim()) return flight.tooltip_text;
    if (canceled) return "Location: Canceled";
    if (deliveredState) return "Location: Delivered";
    return `Location: ${currentlyOver || "somewhere over the U.S."}`;
  }, [flight?.tooltip_text, canceled, deliveredState, currentlyOver]);

  const archivedLabel = archivedAtISO ? `Archived • ${new Date(archivedAtISO).toLocaleString()}` : "Archived";
  const canceledLabel = canceledAtISO ? `Canceled • ${new Date(canceledAtISO).toLocaleString()}` : "Canceled";

  const layout = useMemo<PageLayout>(() => {
    const base = getPageLayout(flightState);
    let next = base;

    if (canceled) {
      next = {
        ...base,
        showLiveBadge: false,
        showLocationPill: false,
        showCountdown: false,
        showSnapshot: true,
        letterStatusLabel: "Canceled",
        canOpenLetter: false,
        timelineModeLabel: "Canceled",
        timelineFinal: true,
        statusPill: {
          icon: "x",
          label: "CANCELED",
          detail: "recalled.",
          trailing: canceledLabel,
          style: { borderColor: "rgba(220,38,38,0.35)", background: "rgba(220,38,38,0.06)" },
          iconStyle: { color: "rgb(220,38,38)" },
        },
      };
    } else if (archived) {
      next = {
        ...base,
        showLiveBadge: false,
        showLocationPill: false,
        showCountdown: false,
        showSnapshot: true,
        timelineModeLabel: "Archived",
        timelineFinal: true,
        statusPill: {
          icon: "timeline",
          label: "ARCHIVED",
          detail: "snapshot view.",
          trailing: archivedLabel,
        },
      };
    }

    const useNightLine = nightFlightExceptionActive && inSleepHoursNow;
    const liveBadge: PageLayout["liveBadge"] = next.showLiveBadge
      ? {
          label: sleeping ? "SLEEPING" : next.liveLabel,
          subLabel: sleeping
            ? `Sleeping — wakes at ${flight?.sleep_local_text || "soon"}${wakeCountdown ? ` (${wakeCountdown})` : ""}`
            : useNightLine
            ? nightLine
            : `Last updated: ${secondsSinceFetch ?? 0}s ago`,
          indicator: sleeping ? "moon" : "dot",
        }
      : null;

    return { ...next, liveBadge };
  }, [
    flightState,
    canceled,
    archived,
    sleeping,
    flight?.sleep_local_text,
    wakeCountdown,
    secondsSinceFetch,
    archivedLabel,
    canceledLabel,
    nightFlightExceptionActive,
    inSleepHoursNow,
    nightLine,
  ]);

  const layoutVars = useMemo(
    () =>
      ({
        "--letter-col": layout.columns.letter,
        "--map-col": layout.columns.map,
        "--letter-height": layout.letterHeight,
        "--map-height": layout.mapHeight,
      } as CSSProperties),
    [layout.columns.letter, layout.columns.map, layout.letterHeight, layout.mapHeight]
  );

  const timelineItemsRaw = useMemo(() => {
    if (!letter) return [];
    return buildTimelineItems({
      now,
      letter,
      checkpointsByTime,
      timelineFinal: layout.timelineFinal,
      uiDelivered: layout.state === "delivered",
      canceled,
      effectiveEtaISO,
      showNightFlightNote: nightFlightExceptionActive,
    });
  }, [now, letter, checkpointsByTime, layout.timelineFinal, layout.state, canceled, effectiveEtaISO, nightFlightExceptionActive]);

  const timelineItemsAll = useMemo(() => {
    return layout.collapseTimeline ? collapseTimelineItems(timelineItemsRaw) : timelineItemsRaw;
  }, [layout.collapseTimeline, timelineItemsRaw]);

  const [timelineExpanded, setTimelineExpanded] = useState(layout.state !== "delivered");

  useEffect(() => {
    setTimelineExpanded(layout.state !== "delivered");
  }, [layout.state]);

  const timelineItems = useMemo(() => {
    if (layout.state === "delivered" && !timelineExpanded) {
      return pickTimelineTail(timelineItemsAll, 3);
    }
    return timelineItemsAll;
  }, [layout.state, timelineExpanded, timelineItemsAll]);

  const timelineRealCount = useMemo(() => {
    return timelineItemsAll.filter((it) => it.kind !== "day").length;
  }, [timelineItemsAll]);

  const latestTimelineKey = useMemo(() => {
    const realItems = timelineItems.filter((it) => it.kind !== "day");
    return realItems.length ? realItems[realItems.length - 1].key : null;
  }, [timelineItems]);

  const currentTimelineKey = useMemo(() => {
    if (layout.highlightLatestTimeline && latestTimelineKey) return latestTimelineKey;
    return pickCurrentTimelineKey({
      items: timelineItems,
      now,
      sleeping,
      uiDelivered: layout.state === "delivered",
      canceled,
    });
  }, [layout.highlightLatestTimeline, layout.state, latestTimelineKey, timelineItems, now, sleeping, canceled]);

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

  const sealSrcs = useMemo(() => sealImageSrcs(letter?.seal_id ?? null), [letter?.seal_id]);
  const envelopeTint = useMemo(() => normalizeEnvelopeTint(letter?.envelope_tint), [letter?.envelope_tint]);
  const envelopeTintColor = useMemo(() => getEnvelopeTintColor(envelopeTint), [envelopeTint]);

  function openLetter() {
    if (!layout.canOpenLetter) return;

    setSealCracking(true);
    setConfetti(true);

    window.setTimeout(() => setLetterOpen(true), 220);
    window.setTimeout(() => setSealCracking(false), 650);
    window.setTimeout(() => setConfetti(false), 1400);
  }

  useEffect(() => {
    if (layout.state !== "delivered") return;
    if (deliveredConfettiRef.current) return;

    deliveredConfettiRef.current = true;
    setConfetti(true);

    const t = window.setTimeout(() => setConfetti(false), 1400);
    return () => window.clearTimeout(t);
  }, [layout.state]);

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

  const modalTitle = `From ${letter.from_name || "Sender"} to ${letter.to_name || "Recipient"}`;
  const liveBadge = layout.liveBadge ?? null;
  const isSleepingBadge = liveBadge?.indicator === "moon";

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

                {layout.showLiveBadge ? (
                  <>
                    <div className="liveStack" style={{ minWidth: 230, flex: "0 0 auto" }}>
                      <div className={`liveWrap ${isSleepingBadge ? "sleep" : ""}`}>
                        {isSleepingBadge ? (
                          <span className="ico" style={{ marginRight: 8 }}>
                            <Ico name="moon" size={14} />
                          </span>
                        ) : (
                          <span className={`liveDot ${isSleepingBadge ? "sleep" : ""}`} />
                        )}
                        <span className="liveText">{liveBadge?.label}</span>
                      </div>
                      <div className="liveSub">{liveBadge?.subLabel}</div>
                    </div>

                    {layout.showLocationPill ? (
                      <div className="metaPill" style={{ flex: "1 1 auto" }}>
                        <span className="ico">
                          <Ico name="pin" />
                        </span>
                        <span>
                          Location: <strong>{currentlyOver}</strong>
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : layout.statusPill ? (
                  <div className="metaPill" style={layout.statusPill.style}>
                    <span className="ico" style={layout.statusPill.iconStyle}>
                      <Ico name={layout.statusPill.icon} />
                    </span>
                    <span>
                      <strong>{layout.statusPill.label}</strong> — {layout.statusPill.detail}{" "}
                      {layout.statusPill.trailing ? <span style={{ opacity: 0.75 }}>{layout.statusPill.trailing}</span> : null}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="etaBox">
              <div className="kicker">ETA</div>
              <div className="etaTime">{etaTextLocal}</div>
              <div className="etaSub" style={{ opacity: 0.75 }}>
                (UTC: {etaTextUTC})
              </div>

              {countdown ? <div className="etaSub">Arrives in {countdown}</div> : null}

              {layout.showSnapshot ? (
                <div className="etaSub">
                  Snapshot: <span style={{ fontVariantNumeric: "tabular-nums" }}>{serverNowUtcText ?? "frozen"}</span>
                </div>
              ) : null}
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

            {layout.showSpeed ? (
              <div className="stat">
                <span className="ico">
                  <Ico name="speed" />
                </span>
                <div>
                  <div className="statLabel">Speed</div>
                  <div className="statValue">{Number(currentSpeedKmh).toFixed(0)} km/h</div>
                </div>
              </div>
            ) : null}

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
        <div className={`statusGrid ${layout.gridMode === "delivered_stack" ? "deliveredStack" : ""}`} style={layoutVars}>
          {/* LEFT: Letter (40%) */}
          <div className="statusCol gridLetter">
            <div className={`card letterCard ${layout.letterPrimary ? "primary" : ""}`} style={{ position: "relative" }}>
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
                  <span>{layout.letterStatusLabel}</span>
                </div>
              </div>

              <div className="soft">
                <div className="subject">{letter.subject || "(No subject)"}</div>

                <div
                  className={layout.waxPulse ? "waxPulse" : ""}
                  style={{ position: "relative", ["--env-tint" as any]: envelopeTintColor }}
                >
                  <WaxSealOverlay
                    opensShort={opensShort}
                    cracking={sealCracking}
                    canceled={canceled}
                    canOpen={layout.canOpenLetter}
                    onOpen={openLetter}
                    sealSrcs={sealSrcs}
                  />
                </div>
              </div>

              <div className="token">Token: {letter.public_token}</div>
            </div>
          </div>

          {/* RIGHT: Map (60%) */}
          <div className="statusCol gridMap">
            <MapSection
              mapStyle={mapStyle}
              setMapStyle={setMapStyle}
              origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
              dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
              progress={progress}
              progressPctFloor={progressPctFloor}
              tooltipText={mapTooltip}
              markerMode={markerMode}
              showLive={layout.showLiveBadge}
              sentAtISO={letter.sent_at}
              etaAtISO={effectiveEtaISO}
              currentlyOver={currentlyOver}
              cardClassName={`${layout.mapPrimary ? "primary" : ""} ${layout.mapDesaturate ? "desaturate" : ""} ${
                layout.state === "delivered" ? "mapComplete" : ""
              }`.trim()}
            />
          </div>

          {/* FULL WIDTH: Timeline */}
          <div className="statusFull gridTimeline">
            <div className="card">
              <div className="cardHead">
                <div>
                  <div className="kicker">Timeline</div>
                  <div className="h2">{layout.timelineTitle}</div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="pillBtn subtle" title="Timeline mode">
                    <span className="ico">
                      <Ico name="live" />
                    </span>
                    {layout.timelineModeLabel}
                  </div>

                  {layout.state === "delivered" ? (
                    <button
                      type="button"
                      className="pillBtn subtle"
                      onClick={() => setTimelineExpanded((prev) => !prev)}
                    >
                      {timelineExpanded
                        ? "Collapse story"
                        : `Show full flight story${timelineRealCount ? ` (${timelineRealCount})` : ""}`}
                    </button>
                  ) : null}
                </div>
              </div>

              <TimelineRail items={timelineItems} now={now} currentKey={currentTimelineKey} birdName={birdName} final={layout.timelineFinal} />
            </div>
          </div>

          {/* FULL WIDTH: Badges */}
          <div className="statusFull gridBadges">
            <div className="card">
              <div className="cardHead" style={{ marginBottom: 10 }}>
                <div>
                  <div className="kicker">Badges</div>
                  <div className="h2">Earned on this flight</div>
                </div>

                <div className="metaPill faint" title="Badges earned so far">
                  <strong>{badgesSorted.length}</strong>
                </div>
              </div>

              {badgesSorted.length === 0 ? (
                <div className="soft">
                  <div className="muted">None yet. The bird is still grinding XP.</div>
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
                        {b.iconSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="badgeIconImg" src={b.iconSrc} alt={b.title} title={b.title} />
                        ) : null}
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
        envelopeTintColor={envelopeTintColor}
      />
      </main>

      {/* ✅ Scoped layout CSS (Map 60% / Letter 40%) */}
      <style jsx>{`
        .statusGrid {
          --letter-col: 5fr;
          --map-col: 7fr;
          --letter-height: 360px;
          --map-height: 380px;
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: start;
        }

        .statusGrid.deliveredStack {
          grid-template-columns: 1fr;
          grid-template-areas:
            "letter"
            "badges"
            "map"
            "timeline";
          gap: 14px;
        }

        .statusGrid.deliveredStack .statusFull {
          grid-column: auto;
        }

        .statusGrid.deliveredStack .gridLetter {
          grid-area: letter;
        }

        .statusGrid.deliveredStack .gridBadges {
          grid-area: badges;
        }

        .statusGrid.deliveredStack .gridMap {
          grid-area: map;
        }

        .statusGrid.deliveredStack .gridTimeline {
          grid-area: timeline;
        }

        .statusGrid.deliveredStack .gridBadges {
          width: 100%;
          min-width: 0;
        }

        .statusGrid.deliveredStack .gridBadges :global(.card) {
          width: 100%;
        }

        :global(.letterCard) {
          min-height: var(--letter-height);
        }

        :global(.mapCard) {
          min-height: var(--map-height);
        }

        :global(.card.primary) {
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 10px 24px rgba(0, 0, 0, 0.08);
        }

        :global(.mapCard.desaturate) :global(.mapShell) {
          filter: saturate(0.7);
        }

        :global(.mapCard.mapComplete) :global(.leaflet-tile-pane),
        :global(.mapCard.mapComplete) :global(.leaflet-map-pane),
        :global(.mapCard.mapComplete) :global(.leaflet-container) {
          filter: saturate(0.82) contrast(0.97) brightness(1.01);
        }

        :global(.mapCard.mapComplete) :global(.leaflet-control-container) {
          opacity: 0.85;
        }

        :global(.mapCard.mapComplete) :global(.leaflet-interactive) {
          opacity: 0.65;
        }

        :global(.mapCard.mapComplete)::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            to bottom,
            rgba(255, 248, 235, 0.35),
            rgba(255, 248, 235, 0.15)
          );
          border-radius: inherit;
        }

        .waxPulse :global(.waxBtn) {
          animation: waxPulse 1.8s ease-in-out infinite;
        }

        :global(.waxImgLoading) {
          width: 86px;
          height: 86px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.06);
        }

        @keyframes waxPulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(180, 24, 24, 0.08);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 0 14px rgba(180, 24, 24, 0.1);
          }
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
            grid-template-columns: var(--letter-col) var(--map-col);
            gap: 14px;
          }
          .statusGrid:not(.deliveredStack) .statusFull {
            grid-column: 1 / -1;
          }

          .statusGrid.deliveredStack {
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "letter letter"
              "badges badges"
              "map timeline";
            gap: 14px;
          }

          .statusGrid.deliveredStack .statusFull {
            grid-column: auto;
          }

          .statusGrid.deliveredStack .gridLetter {
            grid-column: 1 / -1;
          }

          .statusGrid.deliveredStack .gridBadges {
            grid-column: 1 / -1;
            width: 100%;
            min-width: 0;
          }

          .statusGrid.deliveredStack .gridBadges :global(.card) {
            width: 100%;
          }
        }

        @media (min-width: 1280px) {
          .statusGrid {
            gap: 16px;
          }
        }
      `}</style>

      <style jsx global>{`
  .letterModalOverlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .letterModalCard {
    width: min(860px, 100%);
    max-height: calc(100vh - 48px);
    overflow: auto;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 20px 70px rgba(0, 0, 0, 0.35);
    position: relative;
  }

  .letterModalTop {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 18px 8px 18px;
    border-bottom: 1px solid rgba(0,0,0,0.08);
  }

  .letterModalClose {
    border: 0;
    background: rgba(0,0,0,0.06);
    border-radius: 10px;
    padding: 8px;
    cursor: pointer;
  }

  .paperWrap {
    padding: 18px;
  }

  .paperSheet {
    background: var(--env-tint, #fff7ea);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px;
    padding: 18px;
  }

  .paperSubject {
    font-weight: 900;
    margin-bottom: 10px;
  }

  .paperBody {
    white-space: pre-wrap;
    line-height: 1.55;
  }

  /* Optional: keep modal above Leaflet panes */
  .leaflet-pane,
  .leaflet-control {
    z-index: 0;
  }
`}</style>
    </main>
  );
}
