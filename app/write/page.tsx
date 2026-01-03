"use client";

import { useState } from "react";
import { CITIES } from "../lib/cities";
import { CityTypeahead } from "../components/CityTypeahead";

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

function isEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
  const [destination, setDestination] = useState(CITIES[CITIES.length - 1]);

  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [result, setResult] = useState<{ url: string; eta_at: string } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /* ---------- validation ---------- */
  const recipientEmailOk = !toEmail.trim() || isEmailValid(toEmail);
  const senderEmailOk = !fromEmail.trim() || isEmailValid(fromEmail);

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

  /* ---------- swap ---------- */
  function swapRoute() {
    setShowOriginPicker(false);
    const o = origin;
    const d = destination;
    setOrigin(d);
    setDestination(o);
  }

  /* ---------- submit ---------- */
  async function sendLetter() {
    setSending(true);
    setError(null);
    setResult(null);

    // prevent same origin/destination
    if (origin.name === destination.name) {
      setError("Origin and destination must be different (even pigeons get bored).");
      setSending(false);
      return;
    }

    // validate optional emails if present
    if (!recipientEmailOk) {
      setError("Recipient email looks invalid.");
      setSending(false);
      return;
    }
    if (!senderEmailOk) {
      setError("Sender email looks invalid.");
      setSending(false);
      return;
    }

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
  const disableSend =
    sending ||
    !message.trim() ||
    !toName.trim() ||
    !recipientEmailOk ||
    !senderEmailOk;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <a href="/dashboard" style={{ textDecoration: "underline" }}>
        Dashboard
      </a>

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
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
            }}
          />
        </label>

        <label>
          Sender Email (optional)
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="you@email.com"
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
              borderColor: fromEmail.trim() && !senderEmailOk ? "crimson" : undefined,
            }}
          />
        </label>
        {fromEmail.trim() && !senderEmailOk && (
          <div style={{ fontSize: 12, color: "crimson" }}>
            Please enter a valid sender email address.
          </div>
        )}

        <label>
          To
          <input
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            placeholder="Recipient name"
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
            }}
          />
        </label>

        <label>
          Recipient Email (optional)
          <input
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="name@email.com"
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
              borderColor: toEmail.trim() && !recipientEmailOk ? "crimson" : undefined,
            }}
          />
        </label>
        {toEmail.trim() && !recipientEmailOk && (
          <div style={{ fontSize: 12, color: "crimson" }}>
            Please enter a valid recipient email address.
          </div>
        )}

        <label>
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
            }}
          />
        </label>

        <label>
          Message (sealed until delivery)
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
            }}
          />
        </label>

        {/* ---------- ORIGIN + DEST ---------- */}
        <div style={{ marginTop: 6 }}>
          {/* Swap + route preview */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Route: <strong>{origin.name}</strong> → <strong>{destination.name}</strong>
            </div>

            <button
              type="button"
              onClick={swapRoute}
              title="Swap origin and destination"
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #333",
                background: "transparent",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⇄ Swap
            </button>
          </div>

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
                  cursor: "pointer",
                }}
              >
                {showOriginPicker ? "Hide origin picker" : "Change origin"}
              </button>

              {showOriginPicker && (
                <div style={{ marginTop: 8 }}>
                  <CityTypeahead
                    label=""
                    cities={CITIES}
                    value={origin}
                    onChange={(c) => {
                      setOrigin(c);
                      setShowOriginPicker(false);
                    }}
                    placeholder="Type a US city…"
                  />
                </div>
              )}

              {locError && (
                <div style={{ fontSize: 12, color: "crimson", marginTop: 6 }}>
                  {locError}
                </div>
              )}
            </div>

            {/* DESTINATION */}
            <div>
              <CityTypeahead
                label="Destination"
                cities={CITIES}
                value={destination}
                onChange={setDestination}
                placeholder="Type a US city…"
              />
            </div>
          </div>
        </div>

        {/* ---------- SEND ---------- */}
        <button
          onClick={sendLetter}
          disabled={disableSend}
          style={{
            padding: "12px 14px",
            fontWeight: 700,
            cursor: disableSend ? "not-allowed" : "pointer",
            opacity: disableSend ? 0.7 : 1,
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