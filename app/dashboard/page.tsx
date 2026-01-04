"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardLetter = {
  id: string;
  public_token: string;
  from_name: string | null;
  from_email: string | null;
  to_name: string | null;
  to_email: string | null;
  subject: string | null;
  origin_name: string;
  dest_name: string;
  sent_at: string;
  eta_at: string;
  delivered: boolean;
  progress: number; // 0..1
};

type Filter = "all" | "inflight" | "delivered";
type Sort = "newest" | "etaSoonest" | "oldest";

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

function formatUtc(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

async function copyToClipboard(text: string) {
  // Prefer modern clipboard API; fallback for older contexts
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

export default function DashboardPage() {
  const [email, setEmail] = useState("");
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

  // load saved email
  useEffect(() => {
    const saved = localStorage.getItem("cp_sender_email");
    if (saved) setEmail(saved);
  }, []);

  // toast auto-clear
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    const e = email.trim().toLowerCase();
    if (!emailLooksValid(e)) {
      setError("Enter a valid sender email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      localStorage.setItem("cp_sender_email", e);

      const res = await fetch(`/api/dashboard/letters?email=${encodeURIComponent(e)}`, {
        cache: "no-store",
      });
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
      return bSent - aSent; // newest default
    });

    return list;
  }, [letters, filter, sort]);

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

          {/* stats row */}
          {letters.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div className="metaPill">
                Total: <strong>{stats.total}</strong>
              </div>
              <div className="metaPill">
                In flight: <strong>{stats.inflight}</strong>
              </div>
              <div className="metaPill">
                Delivered: <strong>{stats.delivered}</strong>
              </div>

              {/* ✅ NEW: filters + sort */}
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
                placeholder="you@email.com"
              />
            </label>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={load} disabled={loading} className="btnPrimary">
                {loading ? "Loading…" : "Load letters"}
              </button>

              <div className="muted">
                Tip: use the same sender email you entered on the Write page.
              </div>
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
                  : "No letters match your filter."}
              </div>
            </div>
          ) : (
            filteredSorted.map((l) => {
              const pct = Math.round((l.progress ?? 0) * 100);
              const etaMs = new Date(l.eta_at).getTime() - now.getTime();
              const countdown = formatCountdown(etaMs);

              const statusLabel = l.delivered ? "Delivered" : "In Flight";
              const statusEmoji = l.delivered ? "✅" : "🕊️";

              const statusUrl = `${window.location.origin}/l/${l.public_token}`;

              return (
                <div key={l.id} className="card">
                  <div className="cardHead" style={{ marginBottom: 10 }}>
                    <div>
                      <div className="kicker">Letter</div>
                      <div className="h2">{l.subject?.trim() ? l.subject : "(No subject)"}</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        To: <strong>{l.to_name || "Recipient"}</strong>{" "}
                        <span style={{ opacity: 0.65 }}>
                          • {l.origin_name} → {l.dest_name}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <div className="metaPill">
                        {statusEmoji} <strong>{statusLabel}</strong>
                      </div>

                      {/* ✅ NEW: copy link */}
                      <button
                        type="button"
                        className="btnGhost"
                        onClick={async () => {
                          await copyToClipboard(statusUrl);
                          setToast("Link copied 🕊️");
                        }}
                        style={{ padding: "10px 12px" }}
                        title="Copy status link"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>

                  <div className="muted" style={{ marginTop: 2 }}>
                    Sent: {new Date(l.sent_at).toLocaleString()} •{" "}
                    <strong>ETA (UTC):</strong> {formatUtc(l.eta_at)}
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
                      <div className="muted">
                        Token: {l.public_token.slice(0, 8)}…
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <a href={`/l/${l.public_token}`} className="link">
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