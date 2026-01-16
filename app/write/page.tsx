"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CITIES } from "../lib/cities";
import { CityTypeahead } from "../components/CityTypeahead";

// ✅ Pull bird identity + display from one place
import { BIRD_CATALOG } from "@/app/lib/birdsCatalog";
import { normalizeBird, type BirdType } from "@/app/lib/birds";

// ✅ Seals catalog + helpers
import { getSeal, getSealImgSrc, getSelectableSeals } from "@/app/lib/seals";
import { ENVELOPE_TINTS, getEnvelopeTintColor, type EnvelopeTint } from "@/app/lib/envelopeTints";

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

/** Normalize unknown-ish catalog rows safely */
function getBirdSealConfig(row: any) {
  const sealPolicy = (row?.sealPolicy as "selectable" | "fixed" | "none" | undefined) ?? "selectable";
  const defaultSealId = (row?.defaultSealId as string | null | undefined) ?? null;
  const fixedSealId = (row?.fixedSealId as string | null | undefined) ?? null;
  const allowedSealIds = (Array.isArray(row?.allowedSealIds) ? (row.allowedSealIds as string[]) : []) ?? [];
  return { sealPolicy, defaultSealId, fixedSealId, allowedSealIds };
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

  // ✅ catalog entry for display (safe fallback to pigeon)
  const birdEntry = useMemo(() => {
    const all = BIRD_CATALOG ?? [];
    return all.find((b) => b.id === bird) ?? all.find((b) => b.id === "pigeon") ?? null;
  }, [bird]);

  const birdName = birdEntry?.displayLabel ?? "Homing Pigeon";

  const birdGif = useMemo(() => {
    if (birdEntry && "imgSrc" in (birdEntry as any) && (birdEntry as any).imgSrc) {
      return (birdEntry as any).imgSrc as string;
    }

    switch (bird) {
      case "snipe":
        return "/birds/great-snipe.gif";
      case "goose":
        return "/birds/canada-goose.gif";
      default:
        return "/birds/homing-pigeon.gif";
    }
  }, [bird, birdEntry]);

  // ✅ Seal configuration from catalog row
  const sealCfg = useMemo(() => getBirdSealConfig(birdEntry), [birdEntry]);
  const { sealPolicy, defaultSealId, fixedSealId, allowedSealIds } = sealCfg;

  // ✅ Build picker list (IDs -> seal objects)
  const sealOptions = useMemo(() => {
    if (sealPolicy === "selectable" && allowedSealIds.length > 0) {
      return allowedSealIds
        .map((id) => getSeal(id))
        .filter(Boolean)
        .map((s) => s!);
    }
    return getSelectableSeals();
  }, [sealPolicy, allowedSealIds]);

  // ✅ Selected seal state (varies by policy)
  const [sealId, setSealId] = useState<string | null>(null);
  const [envelopeTint, setEnvelopeTint] = useState<EnvelopeTint>("classic");

  // Keep seal selection in sync when bird changes
  useEffect(() => {
    if (sealPolicy === "none") {
      setSealId(null);
      return;
    }

    if (sealPolicy === "fixed") {
      setSealId(fixedSealId ?? null);
      return;
    }

    // selectable:
    const preferred = defaultSealId || sealOptions[0]?.id || null;
    setSealId(preferred);
  }, [sealPolicy, fixedSealId, defaultSealId, sealOptions]);

  const selectedSealImg = useMemo(() => {
    if (!sealId) return null;
    return getSealImgSrc(sealId) || null;
  }, [sealId]);

  const selectedSealLabel = useMemo(() => {
    if (!sealId) return "";
    return getSeal(sealId)?.label ?? sealId;
  }, [sealId]);

  // Step 1: who
  const [fromName, setFromName] = useState("You");
  const [toName, setToName] = useState("");

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

  // ✅ seal ok: only required if selectable/fixed and we have a seal concept
  const sealOk = sealPolicy === "none" ? true : !!sealId;

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
    if (!sealOk) {
      setError("Pick a wax seal first.");
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
          bird,
          // ✅ NEW
          seal_id: sealId,
          envelope_tint: envelopeTint,
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
    !recipientEmailOk ||
    !sealOk;

  const routeLabel = useMemo(() => `${origin.name} → ${destination.name}`, [origin.name, destination.name]);

  return (
    <main className="pageBg">
      <div className="wrap">
        <a href="/dashboard" className="linkPill">
          ← Dashboard
        </a>

        {/* Header + clickable bird preview */}
        <div className="writeHead" style={{ marginTop: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="kicker">Compose</div>
            <h1 className="h1 h1Bold">Write a Letter</h1>

            <p className="muted" style={{ marginTop: 6 }}>
              It’ll unlock for the recipient when the bird lands.
            </p>
          </div>

          <a href="/new" className="birdPreview" aria-label="Change bird" title="Change bird">
            <div className="birdPreviewName">{birdName}</div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="birdPreviewImg" src={birdGif} alt={`${birdName} preview`} />

            <div className="birdPreviewHint" aria-hidden="true">
              Change bird →
            </div>
          </a>
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

          {/* Wax seal */}
          {sealPolicy !== "none" && (
            <section className="card">
              <div className="cardHead" style={{ marginBottom: 10 }}>
                <div>
                  <div className="kicker">Wax seal</div>
                  <div className="h2">Choose a seal</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {sealPolicy === "fixed" ? "This bird insists." : "This will appear on the sealed letter."}
                  </div>
                </div>

                {sealPolicy === "fixed" ? (
                  <div className="metaPill faint" title="This seal is locked for this bird">
                    Locked
                  </div>
                ) : (
                  <div className="metaPill faint">{selectedSealLabel || "Pick one"}</div>
                )}
              </div>

              {sealPolicy === "fixed" ? (
                <div className="sealFixedRow">
                  <div className="sealThumbLarge">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedSealImg || "/waxseal.png"} alt={selectedSealLabel || "Wax seal"} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, letterSpacing: "-0.01em" }}>{selectedSealLabel || "Wax seal"}</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      You can’t change this one. The bird filed the paperwork already.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sealGrid">
                    {sealOptions.map((s) => {
                      const on = s.id === sealId;
                      const img = getSealImgSrc(s.id) || (s as any).imgSrc || "/waxseal.png";

                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`sealPick ${on ? "on" : ""}`}
                          onClick={() => setSealId(s.id)}
                          aria-pressed={on}
                          title={`Choose ${s.label}`}
                        >
                          <span className="sealThumb">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" />
                          </span>
                          <span className="sealLabel">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {!sealOk && (
                    <div className="errorText" style={{ marginTop: 10 }}>
                      Pick a seal to continue.
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* Envelope tint */}
          <section className="card">
            <div className="cardHead" style={{ marginBottom: 10 }}>
              <div>
                <div className="kicker">Envelope</div>
                <div className="h2">Choose a tint</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  A little personality. Same paper.
                </div>
              </div>

              <div className="metaPill faint">{ENVELOPE_TINTS.find((t) => t.id === envelopeTint)?.label ?? "Classic"}</div>
            </div>

            <div className="tintRow">
              {ENVELOPE_TINTS.map((t) => {
                const on = t.id === envelopeTint;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`tintSwatch ${on ? "on" : ""}`}
                    style={{ background: getEnvelopeTintColor(t.id) }}
                    onClick={() => setEnvelopeTint(t.id)}
                    aria-pressed={on}
                    aria-label={`Envelope tint: ${t.label}`}
                    title={t.label}
                  />
                );
              })}
            </div>

            <div className="soft envelope" style={{ marginTop: 14, ["--env-tint" as any]: getEnvelopeTintColor(envelopeTint) }}>
              <div className="sealCard">
                <div className="sealRow">
                  <button type="button" className="waxBtn" aria-label="Wax seal preview" disabled>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedSealImg || "/waxseal.png"} alt="" className="waxImg" />
                  </button>

                  <div>
                    <div className="sealTitle">Sealed letter</div>
                    <div className="sealSub">Preview only</div>
                  </div>
                </div>
              </div>
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
      </div>
      <style jsx>{`
        .tintRow {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .tintSwatch {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }

        .tintSwatch:hover {
          transform: translateY(-1px);
        }

        .tintSwatch.on {
          border-color: rgba(0, 0, 0, 0.35);
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.12);
        }
      `}</style>
    </main>
  );
}
