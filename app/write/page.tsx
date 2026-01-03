"use client";

import { useState } from "react";
import { CITIES } from "../lib/cities";

/* ---------- helpers ---------- */
function nearestCity(
  lat: number,
  lon: number,
  cities: { name: string; lat: number; lon: number }[]
) {
  let best = cities[0];
  let bestDist = Infinity;

  for (const c of cities) {
    const dLat = lat - c.lat;
    const dLon = lon - c.lon;
    const d = dLat * dLat + dLon * dLon;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/* ---------- page ---------- */
export default function WritePage() {
  const [fromName, setFromName] = useState("You");
  const [fromEmail, setFromEmail] = useState("");
  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [origin, setOrigin] = useState(CITIES[0]);
  const [destination, setDestination] = useState(
    CITIES[CITIES.length - 1]
  );

  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [result, setResult] = useState<{ url: string; eta_at: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /* ---------- validation ---------- */
  const emailLooksValid =
    !toEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim());

  /* ---------- geolocation ---------- */
  function useMyLocationForOrigin() {
    setLocError(null);

    if (!navigator.geolocation) {
      setLocError("Geolocation isn’t supported on this device.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const city = nearestCity(latitude, longitude, CITIES);
        setOrigin(city);
        setLocating(false);
      },
      (err) => {
        setLocError(err?.message || "Couldn’t determine location.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  /* ---------- submit ---------- */
  async function sendLetter() {
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/letters/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: fromName,
          from_email: fromEmail.trim() || null,
          to_name: toName,
          to_email: toEmail.trim() || null,
          subject,
          message,
          origin,
          destination,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Send failed");

      setResult({
        url: `${window.location.origin}/l/${data.public_token}`,
        eta_at: data.eta_at,
      });
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setSending(false);
    }
  }

  /* ---------- UI ---------- */
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Write a Letter</h1>
      <p style={{ opacity: 0.7, marginTop: 6 }}>
        It’ll unlock for the recipient when the pigeon lands.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <label>
          From
          <input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Sender Email (optional)
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="you@email.com"
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          To
          <input
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            placeholder="Recipient name"
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Recipient Email (optional)
          <input
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="name@email.com"
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        {toEmail.trim() && !emailLooksValid && (
          <div style={{ fontSize: 12, color: "crimson" }}>
            Please enter a valid email address.
          </div>
        )}

        <label>
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Message (sealed until delivery)
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        {/* ---------- ORIGIN + DEST ---------- */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* ORIGIN */}
          <div>
            <div style={{ fontWeight: 700 }}>Origin</div>

            <div
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #333",
              }}
            >
              {origin.name}
            </div>

            <button
              type="button"
              onClick={useMyLocationForOrigin}
              disabled={locating}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #333",
                background: "transparent",
                fontWeight: 700,
                cursor: locating ? "not-allowed" : "pointer",
              }}
            >
              {locating ? "Finding your roost…" : "Use my location"}
            </button>

            <button
              type="button"
              onClick={() => setShowOriginPicker((v) => !v)}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px dashed #444",
                background: "transparent",
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              {showOriginPicker ? "Hide origin picker" : "Change origin"}
            </button>

            {showOriginPicker && (
              <select
                value={origin.name}
                onChange={(e) =>
                  setOrigin(CITIES.find((c) => c.name === e.target.value)!)
                }
                style={{
                  display: "block",
                  width: "100%",
                  padding: 10,
                  marginTop: 8,
                }}
              >
                {CITIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {locError && (
              <div style={{ fontSize: 12, color: "crimson", marginTop: 6 }}>
                {locError}
              </div>
            )}
          </div>

          {/* DESTINATION */}
          <label>
            Destination
            <select
              value={destination.name}
              onChange={(e) =>
                setDestination(CITIES.find((c) => c.name === e.target.value)!)
              }
              style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ---------- SEND ---------- */}
        <button
          onClick={sendLetter}
          disabled={
            sending ||
            !message.trim() ||
            !toName.trim() ||
            !emailLooksValid
          }
          style={{
            padding: "12px 14px",
            fontWeight: 700,
            cursor: sending ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "Sending…" : "Send Letter"}
        </button>

        {error && <p style={{ color: "crimson" }}>❌ {error}</p>}

        {result && (
          <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8 }}>
            <div style={{ fontWeight: 800 }}>✅ Sent!</div>
            <div style={{ marginTop: 8 }}>
              Share link:{" "}
              <a href={result.url} style={{ textDecoration: "underline" }}>
                {result.url}
              </a>
            </div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              ETA: {new Date(result.eta_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}