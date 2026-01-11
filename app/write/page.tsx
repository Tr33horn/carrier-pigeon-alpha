"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CITIES } from "../lib/cities";
import { CityTypeahead } from "../components/CityTypeahead";

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

type BirdType = "pigeon" | "snipe" | "goose";

function normalizeBird(raw: string | null): BirdType {
  const b = (raw || "").toLowerCase();
  if (b === "snipe") return "snipe";
  if (b === "goose") return "goose";
  return "pigeon";
}

function birdLabel(bird: BirdType) {
  switch (bird) {
    case "snipe":
      return "Great Snipe";
    case "goose":
      return "Canada Goose";
    default:
      return "Homing Pigeon";
  }
}

function birdGifSrc(bird: BirdType) {
  switch (bird) {
    case "snipe":
      return "/birds/great-snipe.gif";
    case "goose":
      return "/birds/canada-goose.gif";
    default:
      return "/birds/homing-pigeon.gif";
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
      setError("Origin and destination must be different (even birds get bored).");
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
      setError("Please write a message (birds can’t carry novels).");
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
    sending || !routeOk || !fromNameOk || !toNameOk || !messageOk || !senderEmailOk || !recipientEmailOk;

  const routeLabel = useMemo(() => `${origin.name} → ${destination.name}`, [origin.name, destination.name]);

  const birdGif = birdGifSrc(bird);

  return (
    <main className="pageBg">
      <div className="wrap">
        <a href="/dashboard" className="linkPill">
          ← Dashboard
        </a>

        {/* ✅ Header + clickable bird preview */}
        <div className="writeHead" style={{ marginTop: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="kicker">Compose</div>
            <h1 className="h1">Write a Letter</h1>

            <p className="muted" style={{ marginTop: 6 }}>
              It’ll unlock for the recipient when the bird lands.
            </p>
          </div>

          {/* ✅ Bird label ABOVE the preview */}
          <div className="birdPreviewWrap">
            <div className="birdTypeLabel" title="Selected bird">
              {birdLabel(bird)}
            </div>

            <a href="/new" className="birdPreview" aria-label="Change bird" title="Change bird">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="birdPreviewImg" src={birdGif} alt={`${birdLabel(bird)} preview`} />
              <div className="birdPreviewHint" aria-hidden="true">
                Change bird →
              </div>
            </a>
          </div>
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

                <button type="button" onClick={useMyLocationForOrigin} disabled={locating} className="btnGhost">
                  {locating ? "Finding your roost…" : "Use my location"}
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
                {disableSend ? "Fill everything in and the bird will clock in." : "Ready for liftoff."}
              </div>
            </div>

            {error && (
              <p className="errorText" style={{ marginTop: 12 }}>
                ❌ {error}
              </p>
            )}

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

        {/* ✅ Styles for the clickable bird preview */}
        <style jsx global>{`
          .writeHead {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
          }

          .birdPreviewWrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            flex: 0 0 auto;
          }

          .birdTypeLabel {
            font-size: 12px;
            font-weight: 900;
            letter-spacing: -0.01em;
            opacity: 0.82;
            padding: 6px 10px;
            border-radius: 999px;
            border: 1px solid rgba(0, 0, 0, 0.1);
            background: rgba(255, 255, 255, 0.55);
            backdrop-filter: blur(6px);
          }

          .birdPreview {
            width: 120px;
            height: 96px;
            border-radius: 18px;
            padding: 10px;
            background: #ffffff; /* ✅ white background for non-transparent GIFs */
            border: 1px solid rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
            text-decoration: none;
            color: inherit;
            cursor: pointer;
            transform: translateZ(0);
          }

          .birdPreviewImg {
            width: 78px;
            height: 58px;
            object-fit: contain;
            filter: saturate(0.8) contrast(1.02);
            transition: filter 180ms ease, transform 180ms ease;
            transform: translateZ(0);
          }

          .birdPreviewHint {
            font-size: 12px;
            line-height: 14px;
            font-weight: 800;
            letter-spacing: -0.01em;
            opacity: 0.72;
            transition: opacity 180ms ease, transform 180ms ease;
            transform: translateY(0px);
            white-space: nowrap;
          }

          /* ✅ tiny "alive" wiggle ONLY on hover/focus */
          .birdPreview:hover .birdPreviewImg,
          .birdPreview:focus-visible .birdPreviewImg {
            filter: saturate(1) contrast(1);
            transform: scale(1.02);
            animation: tinyWiggle 680ms ease-in-out;
          }

          .birdPreview:hover .birdPreviewHint,
          .birdPreview:focus-visible .birdPreviewHint {
            opacity: 1;
            transform: translateY(-1px);
          }

          @keyframes tinyWiggle {
            0% {
              transform: scale(1.02) rotate(0deg);
            }
            20% {
              transform: scale(1.02) rotate(-0.6deg) translateY(-0.5px);
            }
            45% {
              transform: scale(1.02) rotate(0.7deg) translateY(0px);
            }
            70% {
              transform: scale(1.02) rotate(-0.4deg) translateY(-0.3px);
            }
            100% {
              transform: scale(1.02) rotate(0deg);
            }
          }

          /* Nice focus ring for keyboard users */
          .birdPreview:focus-visible {
            outline: 3px solid rgba(56, 132, 255, 0.35);
            outline-offset: 3px;
          }

          @media (prefers-reduced-motion: reduce) {
            .birdPreview:hover .birdPreviewImg,
            .birdPreview:focus-visible .birdPreviewImg {
              animation: none !important;
            }
          }

          @media (max-width: 520px) {
            .birdPreview {
              width: 110px;
              height: 92px;
              border-radius: 16px;
              padding: 8px;
            }
            .birdPreviewImg {
              width: 72px;
              height: 54px;
            }
          }
        `}</style>
      </div>
    </main>
  );
}