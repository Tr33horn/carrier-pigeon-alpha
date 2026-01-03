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

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [letters, setLetters] = useState<DashboardLetter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

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
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div className="metaPill">
                Total: <strong>{stats.total}</strong>
              </div>
              <div className="metaPill">
                In flight: <strong>{stats.inflight}</strong>
              </div>
              <div className="metaPill">
                Delivered: <strong>{stats.delivered}</strong>
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

        {/* list */}
        <div style={{ marginTop: 14 }} className="stack">
          {letters.length === 0 && !loading ? (
            <div className="card">
              <div className="muted">
                No letters loaded yet. Enter your sender email and hit “Load letters”.
              </div>
            </div>
          ) : (
            letters.map((l) => {
              const pct = Math.round((l.progress ?? 0) * 100);
              const etaMs = new Date(l.eta_at).getTime() - now.getTime();
              const countdown = formatCountdown(etaMs);

              const statusLabel = l.delivered ? "Delivered" : "In Flight";
              const statusEmoji = l.delivered ? "✅" : "🕊️";

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

                    <div className="metaPill">
                      {statusEmoji} <strong>{statusLabel}</strong>
                    </div>
                  </div>

                  <div className="muted" style={{ marginTop: 2 }}>
                    Sent: {new Date(l.sent_at).toLocaleString()} • ETA:{" "}
                    {new Date(l.eta_at).toLocaleString()}
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