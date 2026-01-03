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
  // Step 1: who
  const [fromName, setFromName] = useState("You");
  const [toName, setToName] = useState("");

  // Step 4 (collapsed by default): email options (BUT required for now)
  const [fromEmail, setFromEmail] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [showEmailOptions, setShowEmailOptions] = useState(false);

  // Step 2: message
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Step 3: route
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
  const senderEmailOk = isEmailValid(fromEmail);
  const recipientEmailOk = isEmailValid(toEmail);

  const fromNameOk = fromName.trim().length > 0;
  const toNameOk = toName.trim().length > 0;
  const messageOk = message.trim().length > 0;

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
      setError(
        "Origin and destination must be different (even pigeons get bored)."
      );
      setSending(false);
      return;
    }

    // required fields
    if (!fromNameOk) {
      setError("Please enter a sender name.");
      setSending(false);
      return;
    }
    if (!toNameOk) {
      setError("Please enter a recipient name.");
      setSending(false);
      return;
    }
    if (!messageOk) {
      setError("Please write a message (it can be short, pigeons can’t carry novels).");
      setSending(false);
      return;
    }

    // required emails
    if (!senderEmailOk) {
      setError("Please enter a valid sender email address.");
      setSending(false);
      return;
    }
    if (!recipientEmailOk) {
      setError("Please enter a valid recipient email address.");
      setSending(false);
      return;
    }

    try {
      const res = await fetch("/api/letters/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: fromName.trim(),
          from_email: fromEmail.trim(), // required
          to_name: toName.trim(),
          to_email: toEmail.trim(), // required
          subject: subject.trim(),
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
    !fromNameOk ||
    !toNameOk ||
    !messageOk ||
    !senderEmailOk ||
    !recipientEmailOk ||
    origin.name === destination.name;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <a href="/dashboard" style={{ textDecoration: "underline" }}>
        Dashboard
      </a>

      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Write a Letter</h1>
      <p style={{ opacity: 0.7, marginTop: 6 }}>
        It’ll unlock for the recipient when the pigeon lands.
      </p>

      <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
        {/* ---------------- Step 1: WHO ---------------- */}
        <section
          style={{
            border: "1px solid #333",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>1) Who</div>

          <div style={{ display: "grid", gap: 12 }}>
            <label>
              From
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your name"
                style={{
                  display: "block",
                  width: "100%",
                  padding: 10,
                  marginTop: 6,
                  borderColor: !fromNameOk ? "crimson" : undefined,
                }}
              />
            </label>

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
                  borderColor: !toNameOk ? "crimson" : undefined,
                }}
              />
            </label>
          </div>
        </section>

        {/* ---------------- Step 2: MESSAGE ---------------- */}
        <section
          style={{
            border: "1px solid #333",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>2) Message</div>

          <div style={{ display: "grid", gap: 12 }}>
            <label>
              Subject (optional)
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
                  borderColor: !messageOk ? "crimson" : undefined,
                }}
              />
            </label>
            {!messageOk && (
              <div style={{ fontSize: 12, color: "crimson" }}>
                Message is required.
              </div>
            )}
          </div>
        </section>

        {/* ---------------- Step 3: ROUTE ---------------- */}
        <section
          style={{
            border: "1px solid #333",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>3) Route</div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Route: <strong>{origin.name}</strong> →{" "}
              <strong>{destination.name}</strong>
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

          {origin.name === destination.name && (
            <div style={{ fontSize: 12, color: "crimson", marginBottom: 10 }}>
              Origin and destination must be different.
            </div>
          )}

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
        </section>

        {/* ---------------- Step 4: EMAIL OPTIONS (collapsed) ---------------- */}
        <section
          style={{
            border: "1px solid #333",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setShowEmailOptions((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 900 }}>4) Email options</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {showEmailOptions ? "Hide" : "Show"} ▾
              </div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Required for now (until we add accounts).
            </div>
          </button>

          {showEmailOptions && (
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label>
                Sender Email <span style={{ opacity: 0.7 }}>(required)</span>
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
                Recipient Email <span style={{ opacity: 0.7 }}>(required)</span>
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
            </div>
          )}

          {!showEmailOptions && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              {/* Tiny hint so users don’t forget */}
              <div>
                Sender email:{" "}
                <strong>{fromEmail.trim() ? "✓" : "Missing"}</strong>
              </div>
              <div style={{ marginTop: 4 }}>
                Recipient email:{" "}
                <strong>{toEmail.trim() ? "✓" : "Missing"}</strong>
              </div>
              {(!fromEmail.trim() || !toEmail.trim()) && (
                <div style={{ marginTop: 8, color: "crimson" }}>
                  Open “Email options” to add the required email addresses.
                </div>
              )}
            </div>
          )}
        </section>

        {/* ---------------- SEND ---------------- */}
        <button
          onClick={sendLetter}
          disabled={disableSend}
          style={{
            padding: "12px 14px",
            fontWeight: 800,
            borderRadius: 12,
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