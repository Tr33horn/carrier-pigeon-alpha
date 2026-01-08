"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

  delivered: boolean;
  progress: number;

  current_lat: number | null;
  current_lon: number | null;

  current_over_text?: string | null;

  bird?: "pigeon" | "snipe" | "goose";
  sleeping?: boolean;

  sent_utc_text: string;
  eta_utc_text: string;

  eta_utc_iso: string | null;

  badges_count?: number;

  canceled_at?: string | null;
  canceled?: boolean;

  direction?: "sent" | "incoming";
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

function progressFromTimes(opts: {
  nowMs: number;
  sentISO: string;
  etaISO: string | null | undefined;
  delivered: boolean;
  canceled: boolean;
}) {
  const { nowMs, sentISO, etaISO, delivered, canceled } = opts;

  if (canceled) return 0;
  if (delivered) return 1;

  const sentMs = parseMs(sentISO);
  const etaMs = parseMs(etaISO ?? null);

  if (sentMs == null || etaMs == null) return 0;
  if (etaMs <= sentMs) return 1;

  return clamp01((nowMs - sentMs) / (etaMs - sentMs));
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
        <circle
          cx={pts.d.x}
          cy={pts.d.y}
          r="6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          opacity="0.95"
        />

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

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");

  const [sentLetters, setSentLetters] = useState<DashboardLetter[]>([]);
  const [incomingLetters, setIncomingLetters] = useState<DashboardLetter[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  const [tab, setTab] = useState<Tab>("sent");
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
    const saved = localStorage.getItem("cp_sender_email");
    if (saved) setEmail(saved);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("cp_sender_email");
    if (saved && emailLooksValid(saved)) {
      void load(saved, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const res = await fetch(
        `/api/dashboard/letters?email=${encodeURIComponent(e)}&q=${encodeURIComponent(qs)}`,
        { cache: "no-store" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");

      const sent = (data.sentLetters ?? data.letters ?? []) as DashboardLetter[];
      const incoming = (data.incomingLetters ?? []) as DashboardLetter[];

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

      const data = await res.json();
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

    const alreadyCanceled = !!(letter.canceled || (letter.canceled_at && String(letter.canceled_at).trim()));
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

    const prevSent = sentLetters;
    const nowIso = new Date().toISOString();

    setSentLetters((cur) =>
      cur.map((x) =>
        x.id === letter.id
          ? {
              ...x,
              canceled: true,
              canceled_at: x.canceled_at ?? nowIso,
              delivered: false,
              sleeping: false,
              current_over_text: "Canceled",
            }
          : x
      )
    );

    try {
      const res = await fetch(`/api/letters/cancel/${encodeURIComponent(letter.public_token)}`, {
        method: "POST",
        cache: "no-store",
      });

      const data = await res.json();
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

  // ✅ Counts per tab
  const counts = useMemo(() => {
    const sentTotal = sentLetters.length;
    const incomingTotal = incomingLetters.length;

    const sentDelivered = sentLetters.filter((l) => l.delivered).length;
    const incomingDelivered = incomingLetters.filter((l) => l.delivered).length;

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
    let list = [...activeList];

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
    // subtle “breathe” animation on tab change
    setTabBump((n) => n + 1);
  }

  const hasAny = sentLetters.length > 0 || incomingLetters.length > 0;
  const isEmptyAfterLoad = hasAny && filteredSorted.length === 0 && !loading;

  return (
    <main className="pageBg">
      <div className="wrap">
        <div className="card">
          <div className="cardHead">
<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
  <a
    href="/"
    aria-label="FLOK home"
    className="flokMarkLink"
    title="Home"
  >
    <img
      src="/brand/flok-mark.png"
      alt="FLOK"
      className="flokMark"
    />
  </a>

  <div>
    <div className="kicker">Mailbox</div>
    <h1 className="h1">Dashboard</h1>
    <p className="muted" style={{ marginTop: 6 }}>
      Load your mailbox by entering your email. Sent + Incoming are separate tabs now (no more déjà vu).
    </p>
  </div>
</div>

            <a href="/new" className="linkPill">
              + Write a letter
            </a>
          </div>

          {hasAny && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {/* Tabs */}
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
                  Incoming <span className="tabCount">({counts.incoming.total})</span>
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
              <div className="kicker">Lookup</div>
              <div className="h2">Load your mailbox</div>
            </div>
            <div className="metaPill faint">Uses local storage</div>
          </div>

          <div className="stack">
            <label className="field">
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
              />
            </label>

            <label className="field">
              <span className="fieldLabel">Search</span>
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
                {loading ? "Loading…" : "Load letters"}
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

        {/* ✅ Tab switch animation wrapper */}
        <div key={`${tab}-${tabBump}`} className="tabStage" style={{ marginTop: 14 }}>
          <div className="stack">
            {filteredSorted.length === 0 && !loading ? (
              <div className="card">
                <div className="soft">
                  {/* ✅ Incoming empty-state copy */}
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
                    <>
                      <div className="muted">
                        {sentLetters.length === 0 && incomingLetters.length === 0
                          ? "No letters loaded yet. Enter your email and hit “Load letters”."
                          : "No sent letters match your filter/search."}
                      </div>
                    </>
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
                const isCanceled = !!(l.canceled || (l.canceled_at && String(l.canceled_at).trim()));
                const etaIsoResolved = l.eta_utc_iso || l.eta_at;

                const derivedProgress = progressFromTimes({
                  nowMs: now.getTime(),
                  sentISO: l.sent_at,
                  etaISO: etaIsoResolved,
                  delivered: !!l.delivered,
                  canceled: isCanceled,
                });

                const pct = Math.round(derivedProgress * 100);

                const etaAbsMs = parseMs(etaIsoResolved);
                const msLeft = etaAbsMs == null ? null : etaAbsMs - now.getTime();
                const countdown = formatCountdown(msLeft);

                const isSleeping = !!l.sleeping && !l.delivered && !isCanceled;

                const statusLabel = isCanceled
                  ? "Canceled"
                  : l.delivered
                  ? "Delivered"
                  : isSleeping
                  ? "Sleeping"
                  : "In Flight";
                const statusEmoji = isCanceled ? "🛑" : l.delivered ? "✅" : isSleeping ? "😴" : "🕊️";

                const statusPath = `/l/${l.public_token}`;
                const statusUrl =
                  typeof window !== "undefined" ? `${window.location.origin}${statusPath}` : statusPath;

                const canThumb =
                  Number.isFinite(l.origin_lat) &&
                  Number.isFinite(l.origin_lon) &&
                  Number.isFinite(l.dest_lat) &&
                  Number.isFinite(l.dest_lon);

                const current =
                  l.current_lat != null && l.current_lon != null
                    ? { lat: l.current_lat, lon: l.current_lon }
                    : null;

                const geoText = isCanceled
                  ? "Canceled"
                  : l.delivered
                  ? "Delivered"
                  : (l.current_over_text && l.current_over_text.trim()) || "somewhere over the U.S.";

                const sentUtc = (l.sent_utc_text && l.sent_utc_text.trim()) || formatUtcFallback(l.sent_at);
                const etaUtc = (l.eta_utc_text && l.eta_utc_text.trim()) || formatUtcFallback(etaIsoResolved);

                const badgeCount = Math.max(0, Number(l.badges_count ?? 0));
                const isArchivingThis = archivingId === l.id;
                const isCancelingThis = cancelingId === l.id;

                const birdLabel =
                  l.bird === "snipe"
                    ? "Snipe"
                    : l.bird === "goose"
                    ? "Goose"
                    : l.bird === "pigeon"
                    ? "Pigeon"
                    : null;

                const disableActions = isArchivingThis || isCancelingThis;

                const dirTag: Direction =
                  tab === "all"
                    ? l.from_email && l.to_email && l.from_email.toLowerCase() === l.to_email.toLowerCase()
                      ? "both"
                      : (l.direction as any) || "sent"
                    : (tab as any);

                const dirLabel = dirTag === "incoming" ? "INCOMING" : dirTag === "both" ? "SENT + INCOMING" : "SENT";

                // ✅ Badge pill pulse if this token just gained a badge
                const shouldPulseBadge = badgePulseKey === l.public_token;

                return (
                  <div key={`${l.public_token}-${l.direction ?? "x"}`} className="card">
                    <div className="dashRowTop" style={{ marginBottom: 10 }}>
                      <div className="dashRowMain">
                        <div className="kicker">{dirLabel}</div>
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
                        </div>

                        {birdLabel && (
                          <div className="muted" style={{ marginTop: 6, opacity: 0.75 }}>
                            Bird: <strong>{birdLabel}</strong>
                          </div>
                        )}

                        <div className="muted" style={{ marginTop: 6 }}>
                          📍 <strong>{geoText}</strong>
                        </div>

                        {isCanceled && (
                          <div className="muted" style={{ marginTop: 6, opacity: 0.8 }}>
                            This letter was recalled and will not be delivered.
                          </div>
                        )}
                      </div>

                      {canThumb ? (
                        <RouteThumb
                          origin={{ lat: l.origin_lat, lon: l.origin_lon }}
                          dest={{ lat: l.dest_lat, lon: l.dest_lon }}
                          current={current}
                          progress={derivedProgress}
                        />
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div className="metaPill">
                        {statusEmoji} <strong>{statusLabel}</strong>
                      </div>

                      <div
                        className={`metaPill ${shouldPulseBadge ? "badgePop" : ""}`}
                        title="Badges earned so far"
                      >
                        🏅 <strong>{badgeCount}</strong>&nbsp;{badgeCount === 1 ? "Badge" : "Badges"}
                      </div>

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
                            {isCancelingThis ? "Canceling…" : isCanceled ? "Canceled" : "Cancel"}
                          </button>

                          <button
                            type="button"
                            className="btnGhost"
                            onClick={() => void archiveLetter(l)}
                            title="Archive letter (soft delete)"
                            disabled={disableActions || isCanceled}
                          >
                            {isArchivingThis ? "Archiving…" : "Archive"}
                          </button>
                        </>
                      )}
                    </div>

                    <div className="muted" style={{ marginTop: 10 }}>
                      Sent (UTC): {sentUtc} • <strong>ETA (UTC):</strong> {etaUtc}
                      {!l.delivered && !isCanceled && <> • (T-minus {countdown})</>}
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

                    <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <a href={statusPath} className="link">
                        View status
                      </a>
                      <a href="/write" className="link">
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