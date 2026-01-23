"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CITIES } from "../lib/cities";
import { CityTypeahead } from "../components/CityTypeahead";

// ✅ Pull bird identity + display from one place
import { BIRD_CATALOG } from "@/app/lib/birdsCatalog";
import { normalizeBird, type BirdType } from "@/app/lib/birds";

// ✅ Seals catalog + helpers
import { getSeal, getSealImgSrc, getSelectableSeals } from "@/app/lib/seals";
import { ENVELOPE_TINTS, getEnvelopeTintColor, type EnvelopeTint } from "@/app/lib/envelopeTints";
import { safeJson } from "@/app/lib/http";

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
  const [activeStep, setActiveStep] = useState(1);
  const [showPrompts, setShowPrompts] = useState(false);
  const [previewInk, setPreviewInk] = useState(false);
  const [previewPulse, setPreviewPulse] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [sentFX, setSentFX] = useState(false);
  const [successLine, setSuccessLine] = useState("");
  const didMountRef = useRef(false);
  const tintTimerRef = useRef<number | null>(null);
  const sealTimerRef = useRef<number | null>(null);
  const sentFxTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    setReduceMotion(mq.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler as (ev: MediaQueryListEvent) => void);
    } else {
      (mq as MediaQueryList).addListener(handler as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
    }
    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", handler as (ev: MediaQueryListEvent) => void);
      } else {
        (mq as MediaQueryList).removeListener(handler as (this: MediaQueryList, ev: MediaQueryListEvent) => void);
      }
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (tintTimerRef.current) window.clearTimeout(tintTimerRef.current);
    setPreviewInk(true);
    tintTimerRef.current = window.setTimeout(() => setPreviewInk(false), 180);
    return () => {
      if (tintTimerRef.current) window.clearTimeout(tintTimerRef.current);
    };
  }, [envelopeTint, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    if (!didMountRef.current) return;
    if (sealTimerRef.current) window.clearTimeout(sealTimerRef.current);
    setPreviewPulse(true);
    sealTimerRef.current = window.setTimeout(() => setPreviewPulse(false), 180);
    return () => {
      if (sealTimerRef.current) window.clearTimeout(sealTimerRef.current);
    };
  }, [sealId, reduceMotion]);

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

  const stepMeta = useMemo(() => {
    const steps = [
      { id: 1, label: "Who" },
      { id: 2, label: "Message" },
      { id: 3, label: "Route" },
      { id: 4, label: "Seal & Envelope" },
    ];
    const current = steps.find((s) => s.id === activeStep) ?? steps[0];
    return { total: steps.length, label: current.label };
  }, [activeStep]);

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
      setError("Give the bird a destination.");
      setSending(false);
      return;
    }
    if (!fromNameOk) {
      setError("Who's this from? Give the bird a name.");
      setSending(false);
      return;
    }
    if (!fromEmail.trim()) {
      setError("We need a return roost (your email).");
      setSending(false);
      return;
    }
    if (!senderEmailOk) {
      setError("That email doesn't look right.");
      setSending(false);
      return;
    }
    if (!toNameOk) {
      setError("Who's this for? Give the bird a name.");
      setSending(false);
      return;
    }
    if (!toEmail.trim()) {
      setError("We need a landing email.");
      setSending(false);
      return;
    }
    if (!recipientEmailOk) {
      setError("That email doesn't look right.");
      setSending(false);
      return;
    }
    if (!messageOk) {
      setError("The bird won't fly without a message.");
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

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? "Send failed");

      const successLines = ["Bird accepted the letter.", "The bird takes off.", "Bird clocked in."];
      const line = successLines[Math.floor(Math.random() * successLines.length)];
      setSuccessLine(line);
      setSentFX(true);
      if (sentFxTimerRef.current) window.clearTimeout(sentFxTimerRef.current);
      sentFxTimerRef.current = window.setTimeout(() => setSentFX(false), 900);
      if (!reduceMotion) {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
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

            <div className="stepKicker">
              Step {activeStep} of {stepMeta.total} — {stepMeta.label}
            </div>
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
                    <div className="errorText">That email doesn&apos;t look right.</div>
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
                {!messageOk && <div className="errorText">The bird won&apos;t fly without a message.</div>}
              </label>

              <div className="ideaRow">
                <button type="button" className="ideaToggle" onClick={() => setShowPrompts((v) => !v)}>
                  Need an idea?
                </button>
              </div>

              <div className={`ideaPanel ${showPrompts ? "open" : ""}`}>
                {[
                  "I wanted you to have this later…",
                  "When you read this, I hope you’re smiling.",
                  "This felt worth the wait.",
                ].map((text) => (
                  <button
                    key={text}
                    type="button"
                    className="ideaChip"
                    onClick={() =>
                      setMessage((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))
                    }
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
                  Route: <strong>{routeLabel}</strong>
                </div>
              </div>

              <button type="button" onClick={swapRoute} className="btnGhost" title="Swap route">
                ⇄ Swap
              </button>
            </div>

            {!routeOk && (
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

          {/* Step 4 */}
          <section className="card" onFocusCapture={() => setActiveStep(4)} onClick={() => setActiveStep(4)}>
            <div className="cardHead" style={{ marginBottom: 10 }}>
              <div>
                <div className="kicker">Step 4</div>
                <div className="h2">Seal &amp; Envelope</div>
              </div>
            </div>

            <div className="stack" style={{ gap: 14 }}>
              {/* Wax seal */}
              {sealPolicy !== "none" && (
                <div>
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
                </div>
              )}

              {/* Envelope tint */}
              <div>
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

                <div
                  className={`soft envelope envPreview ${previewInk ? "previewInk" : ""} ${previewPulse ? "previewPulse" : ""}`}
                  style={{ marginTop: 14, ["--env-tint" as any]: getEnvelopeTintColor(envelopeTint) }}
                >
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

                <div className="trustLine">No one reads it early. Not even us.</div>
                <div className="trustLine">This will open exactly once.</div>
              </div>
            </div>
          </section>

          {/* Send */}
          <div className="card sendCard">
            <div className="sendStack">
              <button
                onClick={sendLetter}
                disabled={disableSend || sentFX}
                className={`btnPrimary sendBtn ${sentFX && !reduceMotion ? "sendFx" : ""}`}
              >
                {sentFX ? `🪶 ${successLine || "Bird accepted the letter."}` : sending ? "Sending…" : "Send Letter"}
              </button>
              <div className="sendHelper">
                {disableSend
                  ? "Give the bird the missing details, then it can fly."
                  : "You'll be able to track the flight right after sending."}
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
        .stepKicker {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          opacity: 0.6;
        }

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

        .trustLine,
        .sendReassure {
          margin-top: 10px;
          font-size: 12px;
          font-weight: 800;
          opacity: 0.7;
        }

        .envPreview {
          transition: box-shadow 180ms ease, transform 180ms ease;
        }

        .previewInk {
          animation: previewInk 180ms ease;
        }

        .previewPulse {
          animation: previewPulse 180ms ease;
        }

        .sendFx {
          animation: sendFx 520ms ease;
        }

        @keyframes previewInk {
          0% { opacity: 0.95; }
          100% { opacity: 1; }
        }

        @keyframes previewPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(0,0,0,0); }
          50% { transform: scale(1.015); box-shadow: 0 12px 26px rgba(0,0,0,0.08); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(0,0,0,0); }
        }

        @keyframes sendFx {
          0% { transform: scale(1); opacity: 0.95; }
          60% { transform: scale(1.015); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ideaPanel {
            transition: none;
          }
          .previewInk,
          .previewPulse {
            animation: none;
          }
        }

        @media (max-width: 520px) {
          .writeStack {
            gap: 12px;
          }

          .tintRow {
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 4px;
          }

          .tintSwatch {
            width: 40px;
            height: 40px;
            flex: 0 0 auto;
          }

          .envPreview .sealCard {
            max-width: 340px;
            margin: 0 auto;
          }
        }
      `}</style>
    </main>
  );
}

/* Manual test checklist:
   - Step indicator updates when interacting with each section (Who/Message/Envelope/Route).
   - Envelope preview fades on tint change and pulses on seal change (no motion with reduced motion).
   - "Need an idea?" toggles prompts and inserts text correctly.
*/
