"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { CITIES } from "../lib/cities";
import { CityTypeahead } from "../components/CityTypeahead";
import { replaceDraft, useLetterDraftStore, type LatLonCity } from "@/app/lib/letterDraftStore";

/* ---------- helpers ---------- */
function nearestCity(lat: number, lon: number, cities: { name: string; lat: number; lon: number }[]) {
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

export default function NewPage() {
  return (
    <Suspense
      fallback={
        <main className="pageBg">
          <div className="wrap">
            <Link href="/" className="linkPill">
              ← Home
            </Link>
            <div style={{ marginTop: 12 }}>
              <div className="kicker">Compose</div>
              <h1 className="h1">Write a Letter</h1>
              <p className="muted" style={{ marginTop: 6 }}>
                Loading...
              </p>
            </div>
          </div>
        </main>
      }
    >
      <ComposePage />
    </Suspense>
  );
}

function ComposePage() {
  const router = useRouter();
  const draft = useLetterDraftStore();

  // Hydration-safe: only show invalid states after the user attempts to continue
  const [showErrors, setShowErrors] = useState(false);

  // Step 1: who
  const [fromName, setFromName] = useState(draft.fromName || "You");
  const [toName, setToName] = useState(draft.toName || "");

  const [fromEmail, setFromEmail] = useState(draft.fromEmail || "");
  const [toEmail, setToEmail] = useState(draft.toEmail || "");

  // Step 2: message
  const [subject, setSubject] = useState(draft.subject || "");
  const [message, setMessage] = useState(draft.message || "");
  const [showPrompts, setShowPrompts] = useState(false);

  // Step 3: route
  const defaultOrigin = useMemo(() => CITIES[0], []);
  const defaultDest = useMemo(() => CITIES[CITIES.length - 1], []);

  const [origin, setOrigin] = useState<LatLonCity>(draft.origin?.name ? draft.origin : defaultOrigin);
  const [destination, setDestination] = useState<LatLonCity>(draft.destination?.name ? draft.destination : defaultDest);

  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  /* ---------- validation ---------- */
  const senderEmailOk = isEmailValid(fromEmail);
  const recipientEmailOk = isEmailValid(toEmail);

  const fromNameOk = fromName.trim().length > 0;
  const toNameOk = toName.trim().length > 0;
  const messageOk = message.trim().length > 0;

  const routeOk = origin.name !== destination.name;

  const stepMeta = useMemo(() => {
    const steps = [
      { id: 1, label: "Who" },
      { id: 2, label: "Message" },
      { id: 3, label: "Route" },
    ];
    const current = steps.find((s) => s.id === activeStep) ?? steps[0];
    return { total: steps.length, label: current.label };
  }, [activeStep]);

  /* ---------- geolocation ---------- */
  function useMyLocationForOrigin() {
    setLocError(null);

    if (!navigator.geolocation) {
      setLocError("Geolocation isn't supported on this device.");
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
        setLocError(err?.message || "Couldn't determine location.");
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

  /* ---------- continue ---------- */
  function continueToSend() {
    setError(null);
    setShowErrors(true); // enables invalid styling and inline errors

    if (!routeOk) {
      setError("Give the bird a destination.");
      return;
    }
    if (!fromNameOk) {
      setError("Who's this from? Give the bird a name.");
      return;
    }
    if (!fromEmail.trim()) {
      setError("We need a return roost (your email).");
      return;
    }
    if (!senderEmailOk) {
      setError("That email doesn't look right.");
      return;
    }
    if (!toNameOk) {
      setError("Who's this for? Give the bird a name.");
      return;
    }
    if (!toEmail.trim()) {
      setError("We need a landing email.");
      return;
    }
    if (!recipientEmailOk) {
      setError("That email doesn't look right.");
      return;
    }
    if (!messageOk) {
      setError("The bird won't fly without a message.");
      return;
    }

    replaceDraft({
      ...draft,
      fromName: fromName.trim(),
      fromEmail: fromEmail.trim(),
      toName: toName.trim(),
      toEmail: toEmail.trim(),
      subject: subject.trim(),
      message,
      origin,
      destination,
    });

    router.push("/send");
  }

  return (
    <main className="pageBg">
      <div className="wrap">
        <Link href="/" className="linkPill">
          ← Home
        </Link>

        {/* Header */}
        <div className="writeHead" style={{ marginTop: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="kicker">Compose</div>
            <h1 className="h1 h1Bold">Write a Letter</h1>

            <p className="muted" style={{ marginTop: 6 }}>
              Choose the bird and seal after writing.
            </p>

            <div className="stepKicker">
              Step {activeStep} of {stepMeta.total} - {stepMeta.label}
            </div>
          </div>
        </div>

        <div className="stack writeStack" style={{ marginTop: 14 }}>
          {/* Step 1 */}
          <section className="card" onFocusCapture={() => setActiveStep(1)} onClick={() => setActiveStep(1)}>
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
              <div className="stack" style={{ gap: 10 }}>
                <label className="field">
                  <span className="fieldLabel">From</span>
                  <input
                    className={`input ${showErrors && !fromNameOk ? "invalid" : ""}`}
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
                    className={`input ${showErrors && fromEmail.trim() && !senderEmailOk ? "invalid" : ""}`}
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                  {showErrors && fromEmail.trim() && !senderEmailOk && (
                    <div className="errorText">That email doesn&apos;t look right.</div>
                  )}
                </label>
              </div>

              <div className="stack" style={{ gap: 10 }}>
                <label className="field">
                  <span className="fieldLabel">To</span>
                  <input
                    className={`input ${showErrors && !toNameOk ? "invalid" : ""}`}
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
                    className={`input ${showErrors && toEmail.trim() && !recipientEmailOk ? "invalid" : ""}`}
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="name@email.com"
                  />
                  {showErrors && toEmail.trim() && !recipientEmailOk && (
                    <div className="errorText">That email doesn&apos;t look right.</div>
                  )}
                </label>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="card" onFocusCapture={() => setActiveStep(2)} onClick={() => setActiveStep(2)}>
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
                  placeholder="Optional subject..."
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Message</span>
                <textarea
                  className={`textarea ${showErrors && !messageOk ? "invalid" : ""}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Write something worth the flight..."
                />
                {showErrors && !messageOk && (
                  <div className="errorText">The bird won&apos;t fly without a message.</div>
                )}
              </label>

              <div className="ideaRow">
                <button type="button" className="ideaToggle" onClick={() => setShowPrompts((v) => !v)}>
                  Need an idea?
                </button>
              </div>

              <div className={`ideaPanel ${showPrompts ? "open" : ""}`}>
                {[
                  "I wanted you to have this later...",
                  "When you read this, I hope you're smiling.",
                  "This felt worth the wait.",
                ].map((text) => (
                  <button
                    key={text}
                    type="button"
                    className="ideaChip"
                    onClick={() => setMessage((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Step 3 */}
          <section className="card" onFocusCapture={() => setActiveStep(3)} onClick={() => setActiveStep(3)}>
            <div className="cardHead" style={{ marginBottom: 10 }}>
              <div>
                <div className="kicker">Step 3</div>
                <div className="h2">Route</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Route:{" "}
                  <strong>
                    {origin.name} → {destination.name}
                  </strong>
                </div>
              </div>

              <button type="button" onClick={swapRoute} className="btnGhost" title="Swap route">
                Swap
              </button>
            </div>

            {showErrors && !routeOk && (
              <div className="errorText" style={{ marginBottom: 10 }}>
                Give the bird a destination.
              </div>
            )}

            <div className="twoCol">
              <div className="stack">
                <div className="fieldLabel">Origin</div>

                <div className="softRow">
                  <div className="softValue">{origin.name}</div>
                </div>

                <button type="button" onClick={useMyLocationForOrigin} disabled={locating} className="btnGhost">
                  {locating ? "Finding your roost..." : "Use my location"}
                </button>

                <button type="button" onClick={() => setShowOriginPicker((v) => !v)} className="btnSubtle">
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
                      placeholder="Type a US city..."
                    />
                  </div>
                )}

                {locError && <div className="errorText">{locError}</div>}
              </div>

              <div>
                <CityTypeahead
                  label="Destination"
                  cities={CITIES}
                  value={destination}
                  onChange={setDestination}
                  placeholder="Type a US city..."
                />
              </div>
            </div>
          </section>

          {/* Continue */}
          <div className="card sendCard">
            <div className="sendStack">
              <button onClick={continueToSend} className="btnPrimary sendBtn">
                Continue
              </button>
              <div className="sendHelper">You&apos;ll choose the bird and seal next.</div>
            </div>

            {error && (
              <p className="errorText" style={{ marginTop: 12 }}>
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .stepKicker {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          opacity: 0.6;
        }

        .ideaRow {
          display: flex;
          justify-content: flex-start;
          margin-top: 2px;
        }

        .ideaToggle {
          border: 0;
          background: transparent;
          padding: 0;
          font-weight: 800;
          font-size: 12px;
          opacity: 0.7;
          text-decoration: underline;
          cursor: pointer;
        }

        .ideaPanel {
          display: grid;
          gap: 8px;
          margin-top: 6px;
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition: max-height 180ms ease, opacity 180ms ease;
        }

        .ideaPanel.open {
          max-height: 200px;
          opacity: 1;
        }

        .ideaChip {
          text-align: left;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(0, 0, 0, 0.03);
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 700;
          cursor: pointer;
        }

        @media (prefers-reduced-motion: reduce) {
          .ideaPanel {
            transition: none;
          }
        }

        @media (max-width: 520px) {
          .writeStack {
            gap: 12px;
          }
        }
      `}</style>
    </main>
  );
}
