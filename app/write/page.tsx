"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type BirdType = "pigeon" | "hummingbird" | "stork";

function normalizeBird(raw: string | null): BirdType {
  const b = (raw || "").toLowerCase();
  if (b === "hummingbird") return "hummingbird";
  if (b === "stork") return "stork";
  return "pigeon";
}

function birdLabel(bird: BirdType) {
  switch (bird) {
    case "hummingbird":
      return "🐦 Hummingbird";
    case "stork":
      return "🪿 Stork";
    default:
      return "🕊️ Carrier Pigeon";
  }
}

/**
 * ✅ Suspense wrapper required by Next for useSearchParams()
 */
export default function WritePage() {
  return (
    <Suspense
      fallback={
        <main className="pageBg">
          <div className="wrap">
            <a href="/dashboard" className="linkPill">
              ← Dashboard
            </a>
            <div style={{ marginTop: 12 }}>
              <div className="kicker">Compose</div>
              <h1 className="h1">Write a Letter</h1>
              <p className="muted" style={{ marginTop: 6 }}>
                Loading…
              </p>
            </div>
          </div>
        </main>
      }
    >
      <WritePageInner />
    </Suspense>
  );
}

function WritePageInner() {
  const searchParams = useSearchParams();
  const bird: BirdType = normalizeBird(searchParams.get("bird"));

  // Step 1: who
  const [fromName, setFromName] = useState("You");
  const [toName, setToName] = useState("");

  // Emails now live directly under names (no separate Step 4)
  const [fromEmail, setFromEmail] = useState("");
  const [toEmail, setToEmail] = useState("");

  // Step 2: message
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Step 3: route
  const [origin, setOrigin] = useState(CITIES[0]);
  const [destination, setDestination] = useState(CITIES[CITIES.length - 1]);

  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [result, setResult] = useState<{ url: string; eta_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /* ---------- validation ---------- */
  const senderEmailOk = isEmailValid(fromEmail);
  const recipientEmailOk = isEmailValid(toEmail);

  const fromNameOk = fromName.trim().length > 0;
  const toNameOk = toName.trim().length > 0;
  const messageOk = message.trim().length > 0;

  const routeOk = origin.name !== destination.name;

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

  function swapRoute() {
    setShowOriginPicker(false);
    setOrigin(destination);
    setDestination(origin);
  }

  /* ---------- submit ---------- */
  async function sendLetter() {
    setSending(true);
    setError(null);
    setResult(null);

    if (!routeOk) {
      setError("Origin and destination must be different (even pigeons get bored).");
      setSending(false);
      return;
    }
    if (!fromNameOk) {
      setError("Please enter a sender name.");
      setSending(false);
      return;
    }
    if (!senderEmailOk) {
      setError("Please enter a valid sender email address.");
      setSending(false);
      return;
    }
    if (!toNameOk) {
      setError("Please enter a recipient name.");
      setSending(false);
      return;
    }
    if (!recipientEmailOk) {
      setError("Please enter a valid recipient email address.");
      setSending(false);
      return;
    }
    if (!messageOk) {
      setError("Please write a message (pigeons can’t carry novels).");
      setSending(false);
      return;
    }

    try {
      const res = await fetch("/api/letters/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: fromName.trim(),
          from_email: fromEmail.trim(),
          to_name: toName.trim(),
          to_email: toEmail.trim(),
          subject: subject.trim(),
          message,
          origin,
          destination,
          bird, // ✅ chosen bird
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Send failed");

      setResult({
        url: `${window.location.origin}/l/${data.public_token}`,
        eta_at: data.eta_at,
      });
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setSending(false);
    }
  }

  const disableSend =
    sending ||
    !routeOk ||
    !fromNameOk ||
    !toNameOk ||
    !messageOk ||
    !senderEmailOk ||
    !recipientEmailOk;

  const routeLabel = useMemo(
    () => `${origin.name} → ${destination.name}`,
    [origin.name, destination.name]
  );

  return (
    <main className="pageBg">
      <div className="wrap">
        <a href="/dashboard" className="linkPill">
          ← Dashboard
        </a>

        <div style={{ marginTop: 12 }}>
          <div className="kicker">Compose</div>
          <h1 className="h1">Write a Letter</h1>

          <p className="muted" style={{ marginTop: 6 }}>
            Sending with <strong>{birdLabel(bird)}</strong>.{" "}
            <a href="/new" className="link">
              Change bird
            </a>
          </p>

          <p className="muted" style={{ marginTop: 6 }}>
            It’ll unlock for the recipient when the pigeon lands.
          </p>
        </div>

        <div className="stack" style={{ marginTop: 14 }}>
          {/* Step 1 */}
          <section className="card">
            <div className="cardHead" style={{ marginBottom: 10 }}>
              <div>
                <div className="kicker">Step 1</div>
                <div className="h2">Who</div>
              </div>

              <div className="metaPill faint">
                <span>Required</span>
              </div>
            </div>

            <div className="twoCol">
              {/* FROM column */}
              <div className="stack" style={{ gap: 10 }}>
                <label className="field">
                  <span className="fieldLabel">From</span>
                  <input
                    className={`input ${!fromNameOk ? "invalid" : ""}`}
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>

                <label className="field">
                  <span className="fieldLabel">
                    Sender Email <span className="muted">(required)</span>
                  </span>
                  <input
                    className={`input ${fromEmail.trim() && !senderEmailOk ? "invalid" : ""}`}
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                  {fromEmail.trim() && !senderEmailOk && (
                    <div className="errorText">Please enter a valid sender email address.</div>
                  )}
                </label>
              </div>

              {/* TO column */}
              <div className="stack" style={{ gap: 10 }}>
                <label className="field">
                  <span className="fieldLabel">To</span>
                  <input
                    className={`input ${!toNameOk ? "invalid" : ""}`}
                    value={toName}
                    onChange={(e) => setToName(e.target.value)}
                    placeholder="Recipient name"
                  />
                </label>

                <label className="field">
                  <span className="fieldLabel">
                    Recipient Email <span className="muted">(required)</span>
                  </span>
                  <input
                    className={`input ${toEmail.trim() && !recipientEmailOk ? "invalid" : ""}`}
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="name@email.com"
                  />
                  {toEmail.trim() && !recipientEmailOk && (
                    <div className="errorText">Please enter a valid recipient email address.</div>
                  )}
                </label>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="card">
            <div className="cardHead" style={{ marginBottom: 10 }}>
              <div>
                <div className="kicker">Step 2</div>
                <div className="h2">Message</div>
              </div>
              <div className="metaPill faint">Sealed until delivery</div>
            </div>

            <div className="stack">
              <label className="field">
                <span className="fieldLabel">Subject (optional)</span>
                <input
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Optional subject…"
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Message</span>
                <textarea
                  className={`textarea ${!messageOk ? "invalid" : ""}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Write something worth the flight…"
                />
                {!messageOk && <div className="errorText">Message is required.</div>}
              </label>
            </div>
          </section>

          {/* Step 3 */}
          <section className="card">
            <div className="cardHead" style={{ marginBottom: 10 }}>
              <div>
                <div className="kicker">Step 3</div>
                <div className="h2">Route</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Route: <strong>{routeLabel}</strong>
                </div>
              </div>

              <button type="button" onClick={swapRoute} className="btnGhost" title="Swap route">
                ⇄ Swap
              </button>
            </div>

            {!routeOk && (
              <div className="errorText" style={{ marginBottom: 10 }}>
                Origin and destination must be different.
              </div>
            )}

            <div className="twoCol">
              {/* Origin */}
              <div className="stack">
                <div className="fieldLabel">Origin</div>

                <div className="softRow">
                  <div className="softValue">{origin.name}</div>
                </div>

                <button
                  type="button"
                  onClick={useMyLocationForOrigin}
                  disabled={locating}
                  className="btnGhost"
                >
                  {locating ? "Finding your roost…" : "Use my location"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowOriginPicker((v) => !v)}
                  className="btnSubtle"
                >
                  {showOriginPicker ? "Hide origin picker" : "Change origin"}
                </button>

                {showOriginPicker && (
                  <div style={{ marginTop: 4 }}>
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

                {locError && <div className="errorText">{locError}</div>}
              </div>

              {/* Destination */}
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

          {/* Send */}
          <div className="card">
            <div className="sendRow">
              <button onClick={sendLetter} disabled={disableSend} className="btnPrimary">
                {sending ? "Sending…" : "Send Letter"}
              </button>

              <div className="muted" style={{ alignSelf: "center" }}>
                {disableSend ? "Fill everything in and the pigeon will clock in." : "Ready for liftoff."}
              </div>
            </div>

            {error && <p className="errorText" style={{ marginTop: 12 }}>❌ {error}</p>}

            {result && (
              <div className="successBox" style={{ marginTop: 12 }}>
                <div className="successTitle">✅ Sent!</div>
                <div style={{ marginTop: 8 }}>
                  Share link:{" "}
                  <a href={result.url} className="link">
                    {result.url}
                  </a>
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  ETA: {new Date(result.eta_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}