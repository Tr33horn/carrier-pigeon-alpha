"use client";

import { useEffect, useMemo, useState } from "react";
import { checkpointGeoText } from "@/app/lib/geo";

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
  progress: number; // 0..1

  // from API (optional but expected)
  current_lat: number | null;
  current_lon: number | null;

  sent_utc_text: string;
  eta_utc_text: string;
  eta_utc_iso: string | null;

  // ✅ NEW (from /api/dashboard/letters)
  badges_count?: number;
};

type Filter = "all" | "inflight" | "delivered";
type Sort = "newest" | "etaSoonest" | "oldest";

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

function emailLooksValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Fallback formatter (only used if server text fields missing) */
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

  // fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/* ---------- Mini route thumbnail (no Leaflet) ---------- */
function RouteThumb(props: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  current?: { lat: number; lon: number } | null;
  progress: number; // 0..1
}) {
  const W = 160;
  const H = 74;
  const pad = 10;

  const pts = useMemo(() => {
    const o = props.origin;
    const d = props.dest;
    const c = props.current;

    const lons = [o.lon, d.lon, c?.lon].filter(
      (v): v is number => Number.isFinite(v)
    );
    const lats = [o.lat, d.lat, c?.lat].filter(
      (v): v is number => Number.isFinite(v)
    );

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

        {/* origin: filled dot */}
        <circle cx={pts.o.x} cy={pts.o.y} r="4.5" fill="currentColor" />

        {/* destination: hollow ring */}
        <circle
          cx={pts.d.x}
          cy={pts.d.y}
          r="6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          opacity="0.95"
        />

        {/* current: dot + pulse ring */}
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

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");

  const [letters, setLetters] = useState<DashboardLetter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const [toast, setToast] = useState<string | null>(null);

  // tick so countdowns animate
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // load saved email (once)
  useEffect(() => {
    const saved = localStorage.getItem("cp_sender_email");
    if (saved) setEmail(saved);
  }, []);

  // auto-load once if saved email is valid
  useEffect(() => {
    const saved = localStorage.getItem("cp_sender_email");
    if (saved && emailLooksValid(saved)) {
      void load(saved, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // toast auto-clear
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  async function load(emailOverride?: string, qOverride?: string) {
    const e = (emailOverride ?? email).trim().toLowerCase();
    const qs = (qOverride ?? q).trim();

    if (!emailLooksValid(e)) {
      setError("Enter a valid sender email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      localStorage.setItem("cp_sender_email", e);

      const res = await fetch(
        `/api/dashboard/letters?email=${encodeURIComponent(e)}&q=${encodeURIComponent(
          qs
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");

      setLetters((data.letters ?? []) as DashboardLetter[]);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setLetters([]);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const delivered = letters.filter((l) => l.delivered).length;
    const inflight = letters.length - delivered;
    return { delivered, inflight, total: letters.length };
  }, [letters]);

  const filteredSorted = useMemo(() => {
    let list = [...letters];

    if (filter === "inflight") list = list.filter((l) => !l.delivered);
    if (filter === "delivered") list = list.filter((l) => l.delivered);

    list.sort((a, b) => {
      const aSent = Date.parse(a.sent_at);
      const bSent = Date.parse(b.sent_at);
      const aEta = Date.parse(a.eta_at);
      const bEta = Date.parse(b.eta_at);

      if (sort === "etaSoonest") return aEta - bEta;
      if (sort === "oldest") return aSent - bSent;
      return bSent - aSent; // newest
    });

    return list;
  }, [letters, filter, sort]);

  function onLookupKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void load();
    }
  }

  return (
    <main className="pageBg">
      <div className="wrap">
        {/* header */}
        <div className="card">
          <div className="cardHead">
            <div>
              <div className="kicker">Mailbox</div>
              <h1 className="h1">Dashboard</h1>
              <p className="muted" style={{ marginTop: 6 }}>
                View letters you’ve sent by entering the sender email you used on the write form.
              </p>
            </div>

            <a href="/write" className="linkPill">
              + Write a letter
            </a>
          </div>

          {letters.length > 0 && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div className="metaPill">
                Total: <strong>{stats.total}</strong>
              </div>
              <div className="metaPill">
                In flight: <strong>{stats.inflight}</strong>
              </div>
              <div className="metaPill">
                Delivered: <strong>{stats.delivered}</strong>
              </div>

              <div style={{ flex: "1 1 auto" }} />

              <div className="metaPill" style={{ gap: 10 }}>
                <span style={{ opacity: 0.7 }}>Filter</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as Filter)}
                  className="dashSelect"
                >
                  <option value="all">All</option>
                  <option value="inflight">In flight</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div className="metaPill" style={{ gap: 10 }}>
                <span style={{ opacity: 0.7 }}>Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="dashSelect"
                >
                  <option value="newest">Newest</option>
                  <option value="etaSoonest">ETA soonest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* lookup */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="cardHead" style={{ marginBottom: 10 }}>
            <div>
              <div className="kicker">Lookup</div>
              <div className="h2">Load your sent letters</div>
            </div>
            <div className="metaPill faint">Uses local storage</div>
          </div>

          <div className="stack">
            <label className="field">
              <span className="fieldLabel">Sender email</span>
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
                placeholder="subject, recipient, city, token…"
              />
            </label>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
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

        {/* toast */}
        {toast && (
          <div className="dashToast" role="status" aria-live="polite">
            {toast}
          </div>
        )}

        {/* list */}
        <div style={{ marginTop: 14 }} className="stack">
          {filteredSorted.length === 0 && !loading ? (
            <div className="card">
              <div className="muted">
                {letters.length === 0
                  ? "No letters loaded yet. Enter your sender email and hit “Load letters”."
                  : "No letters match your filter/search."}
              </div>
            </div>
          ) : (
            filteredSorted.map((l) => {
              const pct = Math.round(clamp01(l.progress ?? 0) * 100);

              const etaMs = new Date(l.eta_at).getTime() - now.getTime();
              const countdown = formatCountdown(etaMs);

              const statusLabel = l.delivered ? "Delivered" : "In Flight";
              const statusEmoji = l.delivered ? "✅" : "🕊️";

              const statusPath = `/l/${l.public_token}`;
              const statusUrl =
                typeof window !== "undefined"
                  ? `${window.location.origin}${statusPath}`
                  : statusPath;

              const canThumb =
                Number.isFinite(l.origin_lat) &&
                Number.isFinite(l.origin_lon) &&
                Number.isFinite(l.dest_lat) &&
                Number.isFinite(l.dest_lon);

              const current =
                l.current_lat != null && l.current_lon != null
                  ? { lat: l.current_lat, lon: l.current_lon }
                  : null;

              const geoPoint =
                current ??
                (Number.isFinite(l.origin_lat) &&
                Number.isFinite(l.origin_lon) &&
                Number.isFinite(l.dest_lat) &&
                Number.isFinite(l.dest_lon)
                  ? {
                      lat: l.origin_lat + (l.dest_lat - l.origin_lat) * clamp01(l.progress ?? 0),
                      lon: l.origin_lon + (l.dest_lon - l.origin_lon) * clamp01(l.progress ?? 0),
                    }
                  : null);

              const geoText =
                l.delivered
                  ? "Delivered"
                  : geoPoint
                  ? checkpointGeoText(geoPoint.lat, geoPoint.lon)
                  : "somewhere over the U.S.";

              const sentUtc =
                (l.sent_utc_text && l.sent_utc_text.trim()) || formatUtcFallback(l.sent_at);
              const etaUtc =
                (l.eta_utc_text && l.eta_utc_text.trim()) || formatUtcFallback(l.eta_at);

              const badgeCount = Math.max(0, Number(l.badges_count ?? 0));

              return (
                <div key={l.id} className="card">
                  {/* Top row: title + route thumb */}
                  <div className="dashRowTop" style={{ marginBottom: 10 }}>
                    <div className="dashRowMain">
                      <div className="kicker">Letter</div>
                      <div className="h2">{l.subject?.trim() ? l.subject : "(No subject)"}</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        To: <strong>{l.to_name || "Recipient"}</strong>{" "}
                        <span style={{ opacity: 0.65 }}>
                          • {l.origin_name} → {l.dest_name}
                        </span>
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        📍 <strong>{geoText}</strong>
                      </div>
                    </div>

                    {canThumb ? (
                      <RouteThumb
                        origin={{ lat: l.origin_lat, lon: l.origin_lon }}
                        dest={{ lat: l.dest_lat, lon: l.dest_lon }}
                        current={current}
                        progress={l.progress ?? 0}
                      />
                    ) : null}
                  </div>

                  {/* Status + actions row */}
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

                    {/* ✅ Badges pill */}
                    <div className="metaPill" title="Badges earned so far">
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
                    >
                      Copy link
                    </button>
                  </div>

                  {/* time row */}
                  <div className="muted" style={{ marginTop: 10 }}>
                    Sent (UTC): {sentUtc} • <strong>ETA (UTC):</strong> {etaUtc}
                    {!l.delivered && <> • (T-minus {countdown})</>}
                  </div>

                  {/* progress */}
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
    </main>
  );
}