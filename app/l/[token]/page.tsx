"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";


const MapView = dynamic(() => import("./MapView"), { ssr: false });

type Letter = {
  id: string;
  public_token: string;
  from_name: string | null;
  to_name: string | null;
  subject: string | null;
  body: string;
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
};

type Checkpoint = {
  id: string;
  idx: number;
  name: string;
  at: string;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function progressFraction(sentISO: string, etaISO: string, now = new Date()) {
  const sent = new Date(sentISO).getTime();
  const eta = new Date(etaISO).getTime();
  const t = now.getTime();
  if (eta <= sent) return 1;
  return clamp01((t - sent) / (eta - sent));
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

export default function LetterStatusPage() {
  const params = useParams();
  const raw = (params as any)?.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  const [letter, setLetter] = useState<Letter | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // clock tick (for ETA countdown)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // load letter + checkpoints from APIuseEffect(() => {
  useEffect(() => {
    if (!token) return;

  const load = async () => {
    try {
      setError(null);

      const res = await fetch(`/api/letters/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Letter not found");
        return;
      }

      setLetter(data.letter);
      setCheckpoints(data.checkpoints);
    } catch (e: any) {
      console.error("LOAD ERROR:", e);
      setError(e?.message ?? String(e));
    }
  };

  load();
}, [token]);

  const delivered = useMemo(() => {
    if (!letter) return false;
    return now.getTime() >= new Date(letter.eta_at).getTime();
  }, [letter, now]);

  const progress = useMemo(() => {
    if (!letter) return 0;
    return progressFraction(letter.sent_at, letter.eta_at, now);
  }, [letter, now]);

  const countdown = useMemo(() => {
    if (!letter) return "";
    const msLeft = new Date(letter.eta_at).getTime() - now.getTime();
    return formatCountdown(msLeft);
  }, [letter, now]);

  const currentCheckpoint = useMemo(() => {
    if (!checkpoints.length || !letter) return null;
    const t = now.getTime();
    let current: Checkpoint | null = null;
    for (const cp of checkpoints) {
      if (new Date(cp.at).getTime() <= t) current = cp;
    }
    return current ?? checkpoints[0];
  }, [checkpoints, letter, now]);

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 760 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Flight Status</h1>
        <p style={{ color: "crimson", marginTop: 12 }}>❌ {error}</p>
      </main>
    );
  }

  if (!letter) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 760 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Flight Status</h1>
        <p style={{ marginTop: 12, opacity: 0.7 }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Flight Status</h1>
        <div style={{ fontWeight: 800, opacity: 0.8 }}>
          {delivered ? "✅ Delivered" : "🕊️ In Flight"}
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.8 }}>
        <div>
          <strong>Route:</strong> {letter.origin_name} → {letter.dest_name}
        </div>
        <div style={{ marginTop: 4 }}>
          <strong>ETA:</strong> {new Date(letter.eta_at).toLocaleString()}{" "}
          {!delivered && <span style={{ marginLeft: 8 }}>(T-minus {countdown})</span>}
        </div>
        <div style={{ marginTop: 16 }}>
  <MapView
    origin={{ lat: letter.origin_lat, lon: letter.origin_lon }}
    dest={{ lat: letter.dest_lat, lon: letter.dest_lon }}
    progress={progress}
  />
</div>
        <div style={{ marginTop: 4 }}>
          <strong>Distance:</strong> {letter.distance_km.toFixed(0)} km • <strong>Speed:</strong>{" "}
          {letter.speed_kmh.toFixed(0)} km/h
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 16 }}>
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "#222",
            overflow: "hidden",
            border: "1px solid #333",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.round(progress * 100)}%`,
              background: "white",
            }}
          />
        </div>
        <div style={{ marginTop: 6, opacity: 0.8 }}>
          {Math.round(progress * 100)}% • {currentCheckpoint ? `Current: ${currentCheckpoint.name}` : ""}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 900 }}>Checkpoint Timeline</h2>
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {checkpoints.map((cp) => {
            const isPast = new Date(cp.at).getTime() <= now.getTime();
            return (
              <div
                key={cp.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #333",
                  opacity: isPast ? 1 : 0.5,
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {isPast ? "●" : "○"} {cp.name}
                </div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  {new Date(cp.at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message */}
      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 900 }}>
          Letter from {letter.from_name || "Sender"} to {letter.to_name || "Recipient"}
        </h2>

        <div style={{ marginTop: 10, padding: 14, borderRadius: 10, border: "1px solid #333" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>{letter.subject || "(No subject)"}</div>

          {!delivered ? (
            <div style={{ opacity: 0.85 }}>
              <div style={{ fontWeight: 800 }}>🔒 Sealed until delivery</div>
              <div style={{ marginTop: 8 }}>
                This letter will open when the pigeon lands. (No peeking. The bird is watching.)
              </div>
            </div>
          ) : (
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{letter.body}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, opacity: 0.6, fontSize: 12 }}>
        Token: {letter.public_token}
      </div>
    </main>
  );
}