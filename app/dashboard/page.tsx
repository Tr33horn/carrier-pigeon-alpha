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
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Dashboard</h1>
        <a href="/write" style={{ textDecoration: "underline", opacity: 0.85 }}>
          + Write a letter
        </a>
      </div>

      <p style={{ opacity: 0.7, marginTop: 6 }}>
        View letters you’ve sent by entering the sender email you used on the write form.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          border: "1px solid #333",
          display: "grid",
          gap: 10,
        }}
      >
        <label style={{ fontWeight: 800 }}>
          Sender email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              color: "inherit",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 14px",
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading…" : "Load letters"}
          </button>

          {letters.length > 0 && (
            <div style={{ opacity: 0.8 }}>
              Total: <strong>{stats.total}</strong> • In flight:{" "}
              <strong>{stats.inflight}</strong> • Delivered:{" "}
              <strong>{stats.delivered}</strong>
            </div>
          )}
        </div>

        {error && <div style={{ color: "crimson" }}>❌ {error}</div>}
      </div>

      {/* Letter list */}
      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        {letters.length === 0 && !loading ? (
          <div style={{ opacity: 0.65, padding: 14 }}>
            No letters loaded yet. Enter your sender email and hit “Load letters”.
          </div>
        ) : (
          letters.map((l) => {
            const pct = Math.round((l.progress ?? 0) * 100);
            const etaMs = new Date(l.eta_at).getTime() - now.getTime();
            const countdown = formatCountdown(etaMs);
            const status = l.delivered ? "✅ Delivered" : "🕊️ In Flight";

            return (
              <div
                key={l.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #333",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 900 }}>
                    {l.subject?.trim() ? l.subject : "(No subject)"}
                  </div>
                  <div style={{ fontWeight: 800, opacity: 0.85 }}>{status}</div>
                </div>

                <div style={{ opacity: 0.85 }}>
                  <strong>To:</strong> {l.to_name || "Recipient"}{" "}
                  <span style={{ opacity: 0.65 }}>
                    • {l.origin_name} → {l.dest_name}
                  </span>
                </div>

                <div style={{ opacity: 0.75, fontSize: 13 }}>
                  Sent: {new Date(l.sent_at).toLocaleString()} • ETA:{" "}
                  {new Date(l.eta_at).toLocaleString()}{" "}
                  {!l.delivered && <span> • (T-minus {countdown})</span>}
                </div>

                {/* progress bar */}
                <div style={{ marginTop: 2 }}>
                  <div
                    style={{
                      position: "relative",
                      height: 10,
                      borderRadius: 999,
                      background: "#222",
                      overflow: "hidden",
                      border: "1px solid #333",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: "white",
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
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    Progress: <strong>{pct}%</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <a
                    href={`/l/${l.public_token}`}
                    style={{ textDecoration: "underline", fontWeight: 800 }}
                  >
                    View status
                  </a>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>
                    Token: {l.public_token.slice(0, 8)}…
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}