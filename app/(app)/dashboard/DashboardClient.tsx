"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { safeJson } from "@/app/lib/http";
import { getBirdCatalog } from "@/app/lib/birdsCatalog";

type Direction = "sent" | "incoming" | "both";

type DashboardLetter = {
  id: string;
  public_token: string;

  from_name: string | null;
  from_email: string | null;

  to_name: string | null;
  to_email: string | null;

  subject: string | null;

  origin_name: string;
  origin_lat: number;
  origin_lon: number;

  dest_name: string;
  dest_lat: number;
  dest_lon: number;

  sent_at: string;
  eta_at: string;
  opened_at?: string | null;

  delivered: boolean;
  progress: number; // ✅ server truth (sleep-aware)

  current_lat: number | null;
  current_lon: number | null;

  current_over_text?: string | null;

  bird?: "pigeon" | "snipe" | "goose";
  sleeping?: boolean;

  sent_utc_text: string;
  eta_utc_text: string;

  eta_utc_iso: string | null;

  badges_count?: number;
  badges?: { iconSrc: string; title: string }[];

  canceled_at?: string | null;
  canceled?: boolean;

  direction?: "sent" | "incoming";

  // ✅ optional: added by dashboard API (mirrors status API)
  current_speed_kmh?: number;
};

type Filter = "all" | "inflight" | "delivered";
type Sort = "newest" | "etaSoonest" | "oldest";
type Tab = "sent" | "incoming" | "all";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function formatCountdown(ms: number | null) {
  if (ms == null) return "—";
  if (ms <= 0) return "Delivered";

  const totalSec = Math.floor(ms / 1000);
  if (!Number.isFinite(totalSec) || totalSec < 0) return "—";

  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const pad = (x: number) => String(x).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

function emailLooksValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatUtcFallback(iso: string) {
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

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function isCanceledLetter(l: DashboardLetter | null | undefined) {
  if (!l) return false;
  if (l.canceled === true) return true;
  if (l.canceled_at && String(l.canceled_at).trim()) return true;
  return false;
}

/* ---------- Mini route thumbnail (no Leaflet) ---------- */
function RouteThumb(props: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  current?: { lat: number; lon: number } | null;
  progress: number;
}) {
  const W = 160;
  const H = 74;
  const pad = 10;

  const pts = useMemo(() => {
    const o = props.origin;
    const d = props.dest;
    const c = props.current;

    const lons = [o.lon, d.lon, c?.lon].filter((v): v is number => Number.isFinite(v));
    const lats = [o.lat, d.lat, c?.lat].filter((v): v is number => Number.isFinite(v));

    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const spanLon = Math.max(0.000001, maxLon - minLon);
    const spanLat = Math.max(0.000001, maxLat - minLat);

    const project = (lat: number, lon: number) => {
      const x = pad + ((lon - minLon) / spanLon) * (W - pad * 2);
      const y = pad + (1 - (lat - minLat) / spanLat) * (H - pad * 2);
      return { x, y };
    };

    return {
      o: project(o.lat, o.lon),
      d: project(d.lat, d.lon),
      c: c ? project(c.lat, c.lon) : null,
    };
  }, [props.origin, props.dest, props.current]);

  const pct = Math.round(clamp01(props.progress ?? 0) * 100);

  return (
    <div className="routeThumb" aria-hidden>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path
          d={`M ${pts.o.x} ${pts.o.y} L ${pts.d.x} ${pts.d.y}`}
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.55"
          strokeLinecap="round"
        />
        <circle cx={pts.o.x} cy={pts.o.y} r="4.5" fill="currentColor" />
        <circle cx={pts.d.x} cy={pts.d.y} r="6.2" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.95" />

        {pts.c && (
          <>
            <circle cx={pts.c.x} cy={pts.c.y} r="4.6" fill="currentColor" />
            <circle
              className="thumbPulse"
              cx={pts.c.x}
              cy={pts.c.y}
              r="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              opacity="0.35"
            />
          </>
        )}
      </svg>

      <div className="routeThumbPct">{pct}%</div>
    </div>
  );
}

function dedupeByToken(list: DashboardLetter[]) {
  const seen = new Set<string>();
  const out: DashboardLetter[] = [];
  for (const l of list) {
    const key = l.public_token;
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

type Props = {
  initialEmail: string;
};

export default function DashboardClient({ initialEmail }: Props) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(initialEmail || "");
  const [q, setQ] = useState("");

  const [sentLetters, setSentLetters] = useState<DashboardLetter[]>([]);
  const [incomingLetters, setIncomingLetters] = useState<DashboardLetter[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  const [tab, setTab] = useState<Tab>("sent");
  const appliedTabRef = useRef(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const [toast, setToast] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // ✅ Tab animation + micro-reward state
  const [tabBump, setTabBump] = useState(0);
  const [badgePulseKey, setBadgePulseKey] = useState<string | null>(null);
  const prevBadgesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (appliedTabRef.current) return;
    const raw = searchParams.get("tab");
    if (!raw) return;
    const normalized = raw === "inbox" ? "incoming" : raw;
    if (normalized === "sent" || normalized === "incoming" || normalized === "all") {
      setTab(normalized as Tab);
      appliedTabRef.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      return;
    }
    const saved = localStorage.getItem("cp_sender_email");
    if (saved) setEmail(saved);
  }, [initialEmail]);

  useEffect(() => {
    if (initialEmail && emailLooksValid(initialEmail)) {
      void load(initialEmail, "");
      return;
    }
    const saved = localStorage.getItem("cp_sender_email");
    if (saved && emailLooksValid(saved)) {
      void load(saved, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  // ✅ Badge micro-reward: detect increments across both lists
  useEffect(() => {
    const nextMap: Record<string, number> = {};

    const all = [...sentLetters, ...incomingLetters];
    for (const l of all) {
      const key = l.public_token;
      if (!key) continue;
      nextMap[key] = Math.max(0, Number(l.badges_count ?? 0));
    }

    const prev = prevBadgesRef.current;
    let poppedKey: string | null = null;

    for (const [token, nextCount] of Object.entries(nextMap)) {
      const prevCount = Math.max(0, Number(prev[token] ?? 0));
      if (nextCount > prevCount) {
        poppedKey = token;
        break;
      }
    }

    prevBadgesRef.current = nextMap;

    if (poppedKey) {
      setBadgePulseKey(poppedKey);
      setToast("New badge earned 🏅");
      const t = setTimeout(() => setBadgePulseKey(null), 900);
      return () => clearTimeout(t);
    }
  }, [sentLetters, incomingLetters]);

  async function load(emailOverride?: string, qOverride?: string) {
    const e = (emailOverride ?? email).trim().toLowerCase();
    const qs = (qOverride ?? q).trim();

    if (!emailLooksValid(e)) {
      setError("Enter a valid email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      localStorage.setItem("cp_sender_email", e);

      const res = await fetch(`/api/dashboard/letters?email=${encodeURIComponent(e)}&q=${encodeURIComponent(qs)}`, {
        cache: "no-store",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");

      const sentRaw = (data.sentLetters ?? data.letters ?? []) as DashboardLetter[];
      const incomingRaw = (data.incomingLetters ?? []) as DashboardLetter[];

      // ✅ DEFAULT: hide canceled letters (no clutter in test mode)
      const sent = sentRaw.filter((l) => !isCanceledLetter(l));
      const incoming = incomingRaw.filter((l) => !isCanceledLetter(l));

      setSentLetters(sent.map((l) => ({ ...l, direction: "sent" })));
      setIncomingLetters(incoming.map((l) => ({ ...l, direction: "incoming" })));
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setSentLetters([]);
      setIncomingLetters([]);
    } finally {
      setLoading(false);
    }
  }

  async function archiveLetter(letter: DashboardLetter) {
    if (archivingId || cancelingId) return;

    const ok = window.confirm(
      `Archive this letter?\n\n"${letter.subject?.trim() ? letter.subject : "(No subject)"}"\n\nThis hides it from your dashboard but keeps the public link working.`
    );
    if (!ok) return;

    setArchivingId(letter.id);

    const prevSent = sentLetters;
    setSentLetters((cur) => cur.filter((x) => x.id !== letter.id));

    try {
      const res = await fetch(`/api/letters/archive/${encodeURIComponent(letter.public_token)}`, {
        method: "POST",
        cache: "no-store",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? "Archive failed");

      setToast("Archived ✅");
      void load();
    } catch (err: any) {
      setSentLetters(prevSent);
      setToast("Archive failed ❌");
      console.error("ARCHIVE ERROR:", err);
    } finally {
      setArchivingId(null);
    }
  }

  async function cancelLetter(letter: DashboardLetter) {
    if (archivingId || cancelingId) return;

    const alreadyCanceled = isCanceledLetter(letter);
    if (alreadyCanceled) return;

    if (letter.delivered) {
      window.alert("This letter is already delivered — it can’t be canceled.");
      return;
    }

    const ok = window.confirm(
      `Cancel this letter?\n\n"${letter.subject?.trim() ? letter.subject : "(No subject)"}"\n\nThis recalls the bird and permanently seals the message. The public link will show “Canceled.”`
    );
    if (!ok) return;

    setCancelingId(letter.id);

    // ✅ Since canceled is hidden by default, remove it immediately
    const prevSent = sentLetters;
    setSentLetters((cur) => cur.filter((x) => x.id !== letter.id));

    try {
      const res = await fetch(`/api/letters/cancel/${encodeURIComponent(letter.public_token)}`, {
        method: "POST",
        cache: "no-store",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? "Cancel failed");

      setToast("Canceled 🛑");
      void load();
    } catch (err: any) {
      setSentLetters(prevSent);
      setToast("Cancel failed ❌");
      console.error("CANCEL ERROR:", err);
    } finally {
      setCancelingId(null);
    }
  }

  // ✅ Counts per tab (canceled already removed, but we also guard anyway)
  const counts = useMemo(() => {
    const sentVisible = sentLetters.filter((l) => !isCanceledLetter(l));
    const incomingVisible = incomingLetters.filter((l) => !isCanceledLetter(l));

    const sentTotal = sentVisible.length;
    const incomingTotal = incomingVisible.length;

    const sentDelivered = sentVisible.filter((l) => l.delivered).length;
    const incomingDelivered = incomingVisible.filter((l) => l.delivered).length;

    return {
      sent: { total: sentTotal, delivered: sentDelivered, inflight: sentTotal - sentDelivered },
      incoming: {
        total: incomingTotal,
        delivered: incomingDelivered,
        inflight: incomingTotal - incomingDelivered,
      },
    };
  }, [sentLetters, incomingLetters]);

  const activeList = useMemo(() => {
    if (tab === "sent") return [...sentLetters];
    if (tab === "incoming") return [...incomingLetters];
    return [...sentLetters, ...incomingLetters];
  }, [tab, sentLetters, incomingLetters]);

  const filteredSorted = useMemo(() => {
    // ✅ Hard default: never show canceled
    let list = activeList.filter((l) => !isCanceledLetter(l));

    if (filter === "inflight") list = list.filter((l) => !l.delivered);
    if (filter === "delivered") list = list.filter((l) => l.delivered);

    list.sort((a, b) => {
      const aSent = parseMs(a.sent_at) ?? 0;
      const bSent = parseMs(b.sent_at) ?? 0;

      const aEta = parseMs(a.eta_utc_iso) ?? parseMs(a.eta_at) ?? Number.MAX_SAFE_INTEGER;
      const bEta = parseMs(b.eta_utc_iso) ?? parseMs(b.eta_at) ?? Number.MAX_SAFE_INTEGER;

      if (sort === "etaSoonest") return aEta - bEta;
      if (sort === "oldest") return aSent - bSent;
      return bSent - aSent;
    });

    if (tab === "all") list = dedupeByToken(list);
    return list;
  }, [activeList, filter, sort, tab]);

  function onLookupKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void load();
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    setTabBump((n) => n + 1);
  }

  const hasAny = sentLetters.length > 0 || incomingLetters.length > 0;
  const isEmptyAfterLoad = hasAny && filteredSorted.length === 0 && !loading;

  return (
    <main className="pageBg">
      <div className="wrap">
        <style>{`
          .dashWriteMobile { display: none; }
          .dashWriteDesktop { display: inline-flex; }

          @media (max-width: 520px) {
            .dashWriteDesktop { display: none !important; }
            .dashWriteMobile { display: block; margin-top: 12px; }
            .dashWriteMobile a { width: 100%; display: block; text-align: center; }
          }
        `}</style>

        <div className="card">
          <div className="cardHead">
            <div>
              <div className="kicker">Mailbox</div>
              <h1 className="h1">Dashboard</h1>
              <p className="muted" style={{ marginTop: 6 }}>
              Sent + Inbox are separate tabs now (no more déjà vu).
              </p>

              <div className="dashWriteMobile">
                <a href="/new" className="btnPrimary">
                  + Write a letter
                </a>
              </div>
            </div>

            <a href="/new" className="linkPill dashWriteDesktop">
              + Write a letter
            </a>
          </div>

          {hasAny && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div className="metaPill tabsPill" style={{ gap: 6 }}>
                <button
                  type="button"
                  className={`tabBtn ${tab === "sent" ? "on" : ""}`}
                  onClick={() => switchTab("sent")}
                  aria-pressed={tab === "sent"}
                >
                  Sent <span className="tabCount">({counts.sent.total})</span>
                </button>

                <button
                  type="button"
                  className={`tabBtn ${tab === "incoming" ? "on" : ""}`}
                  onClick={() => switchTab("incoming")}
                  aria-pressed={tab === "incoming"}
                >
                  Inbox <span className="tabCount">({counts.incoming.total})</span>
                </button>

                <button
                  type="button"
                  className={`tabBtn ${tab === "all" ? "on" : ""}`}
                  onClick={() => switchTab("all")}
                  aria-pressed={tab === "all"}
                  title="Combined view (dedupes by token)"
                >
                  All
                </button>
              </div>

              <div className="metaPill">
                In flight:{" "}
                <strong>
                  {tab === "incoming"
                    ? counts.incoming.inflight
                    : tab === "sent"
                    ? counts.sent.inflight
                    : counts.sent.inflight + counts.incoming.inflight}
                </strong>
              </div>

              <div className="metaPill">
                Delivered:{" "}
                <strong>
                  {tab === "incoming"
                    ? counts.incoming.delivered
                    : tab === "sent"
                    ? counts.sent.delivered
                    : counts.sent.delivered + counts.incoming.delivered}
                </strong>
              </div>

              <div style={{ flex: "1 1 auto" }} />

              <div className="metaPill" style={{ gap: 10 }}>
                <span style={{ opacity: 0.7 }}>Filter</span>
                <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="dashSelect">
                  <option value="all">All</option>
                  <option value="inflight">In flight</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div className="metaPill" style={{ gap: 10 }}>
                <span style={{ opacity: 0.7 }}>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="dashSelect">
                  <option value="newest">Newest</option>
                  <option value="etaSoonest">ETA soonest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="cardHead" style={{ marginBottom: 10 }}>
            <div>
              <div className="kicker">Search</div>
            </div>
            <div className="metaPill faint" style={{ display: "none" }}>
              Uses local storage
            </div>
          </div>

          <div className="stack">
            {initialEmail ? (
              <input type="hidden" value={email} readOnly />
            ) : (
              <label className="field" style={{ display: "none" }}>
                <span className="fieldLabel">Email</span>
                <input
                  className={`input ${email.trim() && !emailLooksValid(email) ? "invalid" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={onLookupKeyDown}
                  placeholder="you@email.com"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={!!initialEmail}
                />
                {initialEmail ? (
                  <div className="muted" style={{ display: "none" }}>
                    Prefilled from your account.
                  </div>
                ) : null}
              </label>
            )}

            <label className="field">
              <span className="fieldLabel" style={{ display: "none" }}>Search</span>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onLookupKeyDown}
                placeholder="subject, sender/recipient, city, token…"
              />
            </label>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => load()} disabled={loading} className="btnPrimary">
                {loading ? "Searching…" : "Search"}
              </button>

              <button
                type="button"
                className="btnSubtle"
                onClick={() => {
                  setQ("");
                  void load(undefined, "");
                }}
                disabled={loading || !q.trim()}
                title="Clear search"
              >
                Clear
              </button>

              <div className="muted">Tip: search is server-side (fast + consistent).</div>
            </div>

            {error && <div className="errorText">❌ {error}</div>}
          </div>
        </div>

        {toast && (
          <div className="dashToast" role="status" aria-live="polite">
            {toast}
          </div>
        )}

        <div key={`${tab}-${tabBump}`} className="tabStage" style={{ marginTop: 14 }}>
          <div className="stack">
            {filteredSorted.length === 0 && !loading ? (
              <div className="card">
                <div className="soft">
                  {tab === "incoming" ? (
                    <>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Nothing incoming yet.</div>
                      <div className="muted">
                        Your inbox is quiet… in a “peaceful forest” way, not a “broken app” way. 🌿
                        <br />
                        Send a letter to yourself to test, or share your address with a friend.
                      </div>
                    </>
                  ) : tab === "sent" ? (
                    <div className="muted">
                      {sentLetters.length === 0 && incomingLetters.length === 0
                        ? "No letters loaded yet. Enter your email and hit “Load letters”."
                        : "No sent letters match your filter/search."}
                    </div>
                  ) : (
                    <div className="muted">
                      {sentLetters.length === 0 && incomingLetters.length === 0
                        ? "No letters loaded yet. Enter your email and hit “Load letters”."
                        : "No letters match your filter/search."}
                    </div>
                  )}

                  {isEmptyAfterLoad && (
                    <div className="muted" style={{ marginTop: 10, opacity: 0.75 }}>
                      (Try switching tabs or clearing search.)
                    </div>
                  )}
                </div>
              </div>
            ) : (
              filteredSorted.map((l) => {
                const isCanceled = isCanceledLetter(l); // should always be false now, but safe
                const etaIsoResolved = l.eta_utc_iso || l.eta_at;

                // ✅ Progress: SERVER TRUTH (sleep-aware). Fallback only if missing/NaN.
                const serverProgress =
                  typeof l.progress === "number" && Number.isFinite(l.progress) ? clamp01(l.progress) : null;

                const fallbackProgress = (() => {
                  if (isCanceled) return 0;
                  if (l.delivered) return 1;
                  const sentMs = parseMs(l.sent_at);
                  const etaMs = parseMs(etaIsoResolved);
                  if (sentMs == null || etaMs == null) return 0;
                  if (etaMs <= sentMs) return 1;
                  return clamp01((now.getTime() - sentMs) / (etaMs - sentMs));
                })();

                const derivedProgress = serverProgress ?? fallbackProgress;
                const pct = Math.round(derivedProgress * 100);

                const etaAbsMs = parseMs(etaIsoResolved);
                const msLeft = etaAbsMs == null ? null : etaAbsMs - now.getTime();
                const countdown = formatCountdown(msLeft);

                const statusPath = `/l/${l.public_token}`;
                const statusUrl = typeof window !== "undefined" ? `${window.location.origin}${statusPath}` : statusPath;

                const canThumb =
                  Number.isFinite(l.origin_lat) &&
                  Number.isFinite(l.origin_lon) &&
                  Number.isFinite(l.dest_lat) &&
                  Number.isFinite(l.dest_lon);

                const current =
                  l.current_lat != null && l.current_lon != null ? { lat: l.current_lat, lon: l.current_lon } : null;

                const geoText =
                  isCanceled
                    ? "Canceled"
                    : l.delivered
                    ? "Delivered"
                    : (l.current_over_text && l.current_over_text.trim()) || "somewhere over the U.S.";
                const geoTextDisplay = geoText.replace(/sleeping/gi, "Resting");

                const sentUtc = (l.sent_utc_text && l.sent_utc_text.trim()) || formatUtcFallback(l.sent_at);
                const etaUtc = (l.eta_utc_text && l.eta_utc_text.trim()) || formatUtcFallback(etaIsoResolved);

                const isArchivingThis = archivingId === l.id;
                const isCancelingThis = cancelingId === l.id;
                const isOpened = !!l.opened_at;
                const disableActions = isArchivingThis || isCancelingThis;

                const dirTag: Direction =
                  tab === "all"
                    ? l.from_email && l.to_email && l.from_email.toLowerCase() === l.to_email.toLowerCase()
                      ? "both"
                      : (l.direction as any) || "sent"
                    : (tab as any);

                const dirLabel = dirTag === "incoming" ? "INCOMING" : dirTag === "both" ? "SENT + INCOMING" : "SENT";
                const topLabel =
                  isOpened ? "UNSEALED" : dirTag === "incoming" && l.delivered ? "ARRIVED" : dirLabel;
                const hideHeavy = isOpened || l.delivered;
                const showUnsealedStatusStack = l.delivered && isOpened;
                const showDeliveredStatusStack = l.delivered && !isOpened;
                const showSentStatusStack = !l.delivered && !isOpened && !isCanceled;
                const shouldPulseBadge = badgePulseKey === l.public_token;
                const badgeIcons = (l.badges ?? []).filter((b) => b.iconSrc).slice(0, 6);
                const hasBadgeIcons = badgeIcons.length > 0;

                const birdImg = getBirdCatalog(l.bird || "")?.imgSrc || "/birds/homing-pigeon.gif";
                const speedShown =
                  typeof l.current_speed_kmh === "number" && Number.isFinite(l.current_speed_kmh)
                    ? Math.max(0, Math.round(l.current_speed_kmh))
                    : null;

                return (
                  <div key={`${l.public_token}-${l.direction ?? "x"}`} className="card">
                    <div className="dashRowTop" style={{ marginBottom: 10 }}>
                      <div className="birdThumb" aria-hidden>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={birdImg} alt="" />
                      </div>
                      <div className="dashRowMain">
                        <div className="h2">{l.subject?.trim() ? l.subject : "(No subject)"}</div>

                        <div className="muted" style={{ marginTop: 6 }}>
                          {dirLabel === "INCOMING" ? (
                            <>
                              From: <strong>{l.from_name || "Sender"}</strong>{" "}
                            </>
                          ) : (
                            <>
                              To: <strong>{l.to_name || "Recipient"}</strong>{" "}
                            </>
                          )}
                          <span style={{ opacity: 0.65 }}>
                            • {l.origin_name} → {l.dest_name}
                          </span>
                          {l.delivered && l.sent_at && !showUnsealedStatusStack && !showDeliveredStatusStack ? (
                            <span style={{ color: "#E53935", fontWeight: 700, marginLeft: 10 }}>
                              Sent {new Date(l.sent_at).toLocaleString()}
                            </span>
                          ) : null}
                        </div>

                        {showUnsealedStatusStack ? (
                          <div
                            className="muted"
                            style={{
                              marginTop: 6,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              color: "#E53935",
                              fontWeight: 700,
                            }}
                          >
                            <div>Sent {l.sent_at ? new Date(l.sent_at).toLocaleString() : "Unknown"}</div>
                            <div>Delivered {etaIsoResolved ? new Date(etaIsoResolved).toLocaleString() : "Unknown"}</div>
                            <div>Opened {l.opened_at ? new Date(l.opened_at).toLocaleString() : "Unknown"}</div>
                          </div>
                        ) : null}
                        {showDeliveredStatusStack ? (
                          <div
                            className="muted"
                            style={{
                              marginTop: 6,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              color: "#E53935",
                              fontWeight: 700,
                            }}
                          >
                            <div>Sent {l.sent_at ? new Date(l.sent_at).toLocaleString() : "Unknown"}</div>
                            <div>Delivered {etaIsoResolved ? new Date(etaIsoResolved).toLocaleString() : "Unknown"}</div>
                          </div>
                        ) : null}
                        {showSentStatusStack ? (
                          <div
                            className="muted"
                            style={{
                              marginTop: 6,
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              color: "#E53935",
                              fontWeight: 700,
                            }}
                          >
                          <div>Sent {l.sent_at ? new Date(l.sent_at).toLocaleString() : "Unknown"}</div>
                          <div>Status {geoTextDisplay}</div>
                        </div>
                      ) : null}

                        {!showUnsealedStatusStack && !showDeliveredStatusStack && !showSentStatusStack ? (
                          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                            <div className="kicker">{topLabel}</div>
                            {dirTag !== "incoming" && l.sent_at ? (
                              <div className="muted" style={{ color: "#E53935", fontWeight: 700 }}>
                                Sent {new Date(l.sent_at).toLocaleString()}
                              </div>
                            ) : null}
                            {isOpened && l.opened_at ? (
                              <div className="muted" style={{ color: "#E53935", fontWeight: 700 }}>
                                Opened {new Date(l.opened_at).toLocaleString()}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {!showUnsealedStatusStack && !showDeliveredStatusStack && !showSentStatusStack ? (
                          <div className="muted" style={{ marginTop: 6 }}>
                            ✔️ <strong>{geoTextDisplay}</strong>
                            {l.delivered && etaIsoResolved ? (
                              <span style={{ color: "#E53935", fontWeight: 700, marginLeft: 10 }}>
                                Delivered {new Date(etaIsoResolved).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="dashRowSide">
                        {hasBadgeIcons ? (
                          <div className={`badgeIconRow ${shouldPulseBadge ? "badgePop" : ""}`} title="Badges earned">
                            {badgeIcons.map((b, idx) => (
                              <div key={`${l.id}-badge-${idx}`} className="badgeIconTiny" title={b.title}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={b.iconSrc} alt={b.title} />
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {!hideHeavy && canThumb ? (
                          <RouteThumb
                            origin={{ lat: l.origin_lat, lon: l.origin_lon }}
                            dest={{ lat: l.dest_lat, lon: l.dest_lon }}
                            current={current}
                            progress={derivedProgress}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {!hideHeavy && speedShown != null && (
                        <div className="metaPill" title="Current speed">
                          ⚡ <strong>{speedShown}</strong> km/h
                        </div>
                      )}

                      <button
                        type="button"
                        className="btnGhost"
                        onClick={async () => {
                          await copyToClipboard(statusUrl);
                          setToast("Link copied 🕊️");
                        }}
                        title="Copy status link"
                        disabled={disableActions}
                      >
                        Copy link
                      </button>

                      {dirLabel !== "INCOMING" && (
                        <>
                          <button
                            type="button"
                            className="btnGhost"
                            onClick={() => void cancelLetter(l)}
                            title="Cancel (recall) letter"
                            disabled={disableActions || l.delivered || isCanceled}
                          >
                            {isCancelingThis ? "Canceling…" : "Cancel"}
                          </button>

                          <button
                            type="button"
                            className="btnGhost"
                            onClick={() => void archiveLetter(l)}
                            title="Archive letter (soft delete)"
                            disabled={disableActions}
                          >
                            {isArchivingThis ? "Archiving…" : "Archive"}
                          </button>
                        </>
                      )}
                    </div>

                    {!hideHeavy ? (
                      <>
                        <div className="muted" style={{ marginTop: 10 }}>
                          Sent (UTC): {sentUtc} • <strong>ETA (UTC):</strong> {etaUtc}
                          {!l.delivered && <> • (T-minus {countdown})</>}
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <div className="bar">
                            <div className="barFill" style={{ width: `${pct}%` }} />
                            {[25, 50, 75].map((p) => (
                              <span key={p} className="barTick" style={{ left: `${p}%` }} />
                            ))}
                          </div>

                          <div className="barMeta">
                            <div className="mutedStrong">
                              Progress: <strong>{pct}%</strong>
                            </div>
                            <div className="muted">Token: {l.public_token.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </>
                    ) : null}

                    <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <a href={statusPath} className="link">
                        {dirTag === "incoming" ? (isOpened ? "Open" : l.delivered ? "Unseal" : "View status") : "View status"}
                      </a>
                      <a href="/new" className="link">
                        Write another
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
