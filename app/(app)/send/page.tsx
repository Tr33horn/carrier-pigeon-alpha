"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { getEnabledBirdTypes, type BirdType } from "@/app/lib/birds";
import { BIRD_CATALOG, enabledBirdCatalog, type BirdCatalogRow } from "@/app/lib/birdsCatalog";
import { ENVELOPE_TINTS, getEnvelopeTintColor, type EnvelopeTint } from "@/app/lib/envelopeTints";
import { safeJson } from "@/app/lib/http";
import { clearDraft, setDraft, useLetterDraftStore } from "@/app/lib/letterDraftStore";
import { getSeal, getSealImgSrc, getSelectableSeals } from "@/app/lib/seals";
import type { StationeryId } from "@/app/lib/stationery";

type BirdOption = {
  id: BirdType;
  title: string;
  subtitle: string;
  imgSrc: string;
  recommended?: boolean;
};

function getBirdSealConfig(row: BirdCatalogRow | null) {
  const sealPolicy = row?.sealPolicy ?? "selectable";
  const defaultSealId = row?.defaultSealId ?? null;
  const fixedSealId = row?.fixedSealId ?? null;
  const allowedSealIds = Array.isArray(row?.allowedSealIds) ? row.allowedSealIds : null;
  return { sealPolicy, defaultSealId, fixedSealId, allowedSealIds };
}

export default function SendPage() {
  const router = useRouter();

  // store draft (external store)
  const draft = useLetterDraftStore();

  // ✅ Mount gate state (do NOT early-return before hooks)
  const [mounted, setMounted] = useState(false);

  // Local ritual state (seeded from initial draft snapshot)
  const [bird, setBird] = useState<BirdType | null>(draft.bird ?? null);
  const [sealId, setSealId] = useState<string | null>(draft.sealId ?? null);
  const [envelopeTint, setEnvelopeTint] = useState<EnvelopeTint>((draft.envelopeTint as EnvelopeTint) || "classic");
  const [stationeryId, setStationeryId] = useState<StationeryId>(draft.stationeryId ?? "plain-cotton");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; eta_at: string } | null>(null);
  const [holding, setHolding] = useState(false);
  const [holdRemainingMs, setHoldRemainingMs] = useState(0);
  const holdTimerRef = useRef<number | null>(null);

  // Always mount-set in an effect (hook order stable)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Once mounted, if draft got hydrated from sessionStorage, sync local ritual state
  // BUT: don't overwrite if user already picked something in this session.
  useEffect(() => {
    if (!mounted) return;

    setBird((prev) => prev ?? draft.bird ?? null);
    setSealId((prev) => prev ?? draft.sealId ?? null);

    // ✅ FIX: don't force "classic" and block hydration
    setEnvelopeTint((prev) => prev ?? (draft.envelopeTint as EnvelopeTint) ?? "classic");
    setStationeryId((prev) => prev ?? draft.stationeryId ?? "plain-cotton");
  }, [mounted, draft.bird, draft.sealId, draft.envelopeTint, draft.stationeryId]);

  // Draft completeness
  const hasDraft =
    !!draft.fromName &&
    !!draft.fromEmail &&
    !!draft.toName &&
    !!draft.toEmail &&
    !!draft.message &&
    !!draft.origin?.name &&
    !!draft.destination?.name;

  // Redirect after mount only — BUT don’t redirect after a successful send
  useEffect(() => {
    if (!mounted) return;
    if (result) return; // ✅ stay on this page to show the "Sent" moment
    if (!hasDraft) router.replace("/new");
  }, [mounted, hasDraft, router, result]);

  // Enabled bird options
  const enabledTypes = useMemo(() => getEnabledBirdTypes(), []);
  const enabledCatalog = useMemo(() => enabledBirdCatalog(), []);

  const options = useMemo<BirdOption[]>(() => {
    const supported = new Set<BirdType>(enabledTypes);

    return (enabledCatalog as BirdCatalogRow[])
      .filter((row) => row.visible)
      .filter((row) => supported.has(row.id as BirdType))
      .map((row) => ({
        id: row.id as BirdType,
        title: row.displayLabel,
        subtitle: row.availabilityNotes ?? "",
        imgSrc: row.imgSrc || "/birds/homing-pigeon.gif",
        recommended: row.id === "pigeon",
      }));
  }, [enabledCatalog, enabledTypes]);

  const hasPigeon = useMemo(() => options.some((opt) => opt.id === "pigeon"), [options]);

  // Bird entry for seal policy
  const birdEntry = useMemo(() => {
    if (!bird) return null;
    return (BIRD_CATALOG as BirdCatalogRow[]).find((b) => b.id === bird) ?? null;
  }, [bird]);

  const sealCfg = useMemo(() => getBirdSealConfig(birdEntry), [birdEntry]);
  const { sealPolicy, defaultSealId, fixedSealId, allowedSealIds } = sealCfg;

  const sealOptions = useMemo(() => {
    if (sealPolicy !== "selectable") return [];
    if (allowedSealIds && allowedSealIds.length > 0) {
      return allowedSealIds
        .map((id) => getSeal(id))
        .filter(Boolean)
        .map((s) => s!);
    }
    if (allowedSealIds && allowedSealIds.length === 0) return [];
    return getSelectableSeals();
  }, [sealPolicy, allowedSealIds]);

  const showSealPicker = sealPolicy === "selectable" && sealOptions.length > 0;

  // Sync local selections into store (after mount)
  useEffect(() => {
    if (!mounted) return;
    setDraft({ bird });
  }, [mounted, bird]);

  useEffect(() => {
    if (!mounted) return;
    setDraft({ envelopeTint });
  }, [mounted, envelopeTint]);

  useEffect(() => {
    if (!mounted) return;
    setDraft({ sealId });
  }, [mounted, sealId]);

  useEffect(() => {
    if (!mounted) return;
    setDraft({ stationeryId });
  }, [mounted, stationeryId]);

  useEffect(() => {
    if (!mounted) return;
    if (!draft.hydrated) return;
    if (bird || draft.bird) return;
    if (hasPigeon) setBird("pigeon");
  }, [mounted, draft.hydrated, bird, draft.bird, hasPigeon]);

  // Enforce seal policy when bird/policy changes
  useEffect(() => {
    if (!mounted) return;

    if (!bird) {
      if (sealId !== null) setSealId(null);
      return;
    }

    if (sealPolicy === "none") {
      if (sealId !== null) setSealId(null);
      return;
    }

    if (sealPolicy === "fixed") {
      const next = fixedSealId ?? null;
      if (sealId !== next) setSealId(next);
      return;
    }

    // selectable
    if (sealOptions.length === 0) {
      if (sealId !== null) setSealId(null);
      return;
    }

    const allowed = sealOptions.map((s) => s.id);
    if (sealId && allowed.includes(sealId)) return;

    const preferred = (defaultSealId && allowed.includes(defaultSealId) ? defaultSealId : null) || sealOptions[0]?.id || null;
    if (sealId !== preferred) setSealId(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, bird, sealPolicy, fixedSealId, defaultSealId, sealOptions]);

  const selectedSealImg = useMemo(() => {
    if (!sealId) return null;
    return getSealImgSrc(sealId) || null;
  }, [sealId]);

  const selectedSealLabel = useMemo(() => {
    if (!sealId) return "";
    return getSeal(sealId)?.label ?? sealId;
  }, [sealId]);

  const sealOk = sealPolicy === "none" || (sealPolicy === "selectable" && !showSealPicker) ? true : !!sealId;

  async function sendNow() {
    setSending(true);
    setError(null);

    if (!hasDraft) {
      setError("Finish the letter first.");
      setSending(false);
      return;
    }
    if (!bird) {
      setError("Pick a bird to carry it.");
      setSending(false);
      return;
    }
    if (!sealOk) {
      setError("Pick a seal to finish it.");
      setSending(false);
      return;
    }

    try {
      const res = await fetch("/api/letters/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: draft.fromName,
          from_email: draft.fromEmail,
          to_name: draft.toName,
          to_email: draft.toEmail,
          subject: draft.subject,
          message: draft.message,
          origin: draft.origin,
          destination: draft.destination,
          bird,
          seal_id: sealId,
          envelope_tint: envelopeTint,
          stationery_id: stationeryId,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error ?? "Send failed");

      setResult({
        url: `${window.location.origin}/l/${data.public_token}`,
        eta_at: data.eta_at,
      });
      setHolding(false);
      setHoldRemainingMs(0);

      // ✅ Clear draft after success, but we stay here because `result` exists
      clearDraft();
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setSending(false);
    }
  }

  function clearHoldTimer() {
    if (holdTimerRef.current != null) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function cancelHold() {
    clearHoldTimer();
    setHolding(false);
    setHoldRemainingMs(0);
  }

  function startHold() {
    if (sending || result || holding) return;
    const HOLD_MS = 3000;
    setHolding(true);
    setHoldRemainingMs(HOLD_MS);
    const start = Date.now();
    clearHoldTimer();
    holdTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, HOLD_MS - elapsed);
      setHoldRemainingMs(remaining);
      if (remaining <= 0) {
        clearHoldTimer();
        sendNow();
      }
    }, 80);
  }

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, []);

  // ✅ Render gate AFTER all hooks are declared
  if (!mounted) return null;
  if (!hasDraft && !result) return null; // ✅ allow success view even after draft is cleared

  return (
    <main className="pageBg sendPage">
      <div className="wrap">
        <Link href="/new" className="linkPill">
          ← Back to letter
        </Link>

        <div style={{ marginTop: 12 }}>
          <div className="kicker">Send</div>
          <h1 className="h1">Choose how it travels</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Your letter is written. Now choose the bird and seal.
          </p>
        </div>

        {/* Bird selection */}
        <section className="card" style={{ marginTop: 14 }}>
          <div className="cardHead" style={{ marginBottom: 10 }}>
            <div>
              <div className="kicker">Bird</div>
              <div className="h2">Pick the carrier</div>
            </div>
            <div className="metaPill faint">Required</div>
          </div>

          <div className="birdGrid">
            {options.map((opt) => {
              const on = bird === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`card birdCard ${on ? "on" : ""}`}
                  onClick={() => setBird(opt.id)}
                  aria-pressed={on}
                  title={`Choose ${opt.title}`}
                >
                  {opt.recommended && <div className="birdRec">Recommended</div>}

                  <div className="birdRow">
                    <div className="birdThumb" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={opt.imgSrc} alt="" />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div className="birdTitle">{opt.title}</div>
                      <div className="muted birdSub">{opt.subtitle}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Seal & Envelope */}
        <section className="card" style={{ marginTop: 14 }}>
          <div className="cardHead" style={{ marginBottom: 10 }}>
            <div>
              <div className="kicker">Seal &amp; Envelope</div>
              <div className="h2">Finalize the ritual</div>
            </div>
          </div>

          <div className="stack" style={{ gap: 14 }}>
            <div>
              <div className="cardHead" style={{ marginBottom: 10 }}>
                <div>
                  <div className="kicker">Envelope</div>
                  <div className="h2">Choose a tint</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    A little personality. Same paper.
                  </div>
                </div>

                <div className="metaPill faint">
                  {ENVELOPE_TINTS.find((t) => t.id === envelopeTint)?.label ?? "Classic"}
                </div>
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
            </div>

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
                      <div style={{ fontWeight: 900, letterSpacing: "-0.01em" }}>
                        {selectedSealLabel || "Wax seal"}
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        You can&apos;t change this one. The bird filed the paperwork already.
                      </div>
                    </div>
                  </div>
                ) : showSealPicker ? (
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
                        Pick a seal to finish it.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="muted">This bird doesn&apos;t accept seals.</div>
                )}
              </div>
            )}

            <div
              className="soft envelope"
              style={{ marginTop: 4, ["--env-tint" as any]: getEnvelopeTintColor(envelopeTint) }}
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

            <div className="trustLine">This will open exactly once.</div>
          </div>
        </section>

        {/* Send */}
        <div className="card sendCard" style={{ marginTop: 14 }}>
          <div className="sendStack">
            <button
              type="button"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              disabled={sending || !!result}
              className="btnPrimary sendBtn holdBtn"
              style={{
                ["--hold-progress" as any]: holding ? (3000 - holdRemainingMs) / 3000 : 0,
              }}
            >
              <span className="holdLabel">
                {result ? "Released" : sending ? "Releasing..." : "Hold to release"}
              </span>
            </button>
            {!result && !sending && (
              <div className="muted" style={{ fontSize: 12 }}>
                {holding ? `Keep holding… ${Math.ceil(holdRemainingMs / 1000)}s` : "Press and hold to confirm."}
              </div>
            )}
            <div className="sendHelper">
              {result ? "The bird has departed." : "This may arrive earlier or later than planned."}
            </div>
          </div>

          {error && (
            <p className="errorText" style={{ marginTop: 12 }}>
              {error}
            </p>
          )}

          {result && (
            <div className="successBox" style={{ marginTop: 12 }}>
              <div className="successTitle">Sent!</div>
              <div style={{ marginTop: 8 }}>
                Share link:{" "}
                <a href={result.url} className="link">
                  {result.url}
                </a>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                ETA: {new Date(result.eta_at).toLocaleString()}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="btnPrimary" href={result.url}>
                  View flight
                </a>
                <Link className="btnGhost" href="/new">
                  Write another
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
