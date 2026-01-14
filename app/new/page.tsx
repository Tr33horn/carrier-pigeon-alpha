"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

// ✅ Flight-engine truth (types + enabled BirdType list)
import { getEnabledBirdTypes, type BirdType } from "@/app/lib/birds";

// ✅ Catalog truth (rows + enabled filter)
import { BIRD_CATALOG, enabledBirdCatalog, type BirdCatalogRow } from "@/app/lib/birdsCatalog";

type BirdOption = {
  id: BirdType;
  title: string;
  subtitle: string;
  imgSrc: string;
  recommended?: boolean;
};

type FutureBirdOption = {
  id: string;
  title: string;
  subtitle: string;
  imgSrc: string;
};

export default function NewPage() {
  const router = useRouter();

  // ✅ BirdType list that the engine currently accepts AND is enabled in catalog (birds.ts enforces this)
  const enabledTypes = useMemo(() => getEnabledBirdTypes(), []);

  // ✅ Catalog rows that are enabled (catalog-side)
  const enabledCatalog = useMemo(() => enabledBirdCatalog(), []);

  // ✅ Convert catalog → picker options (ONLY ones the engine supports)
  const options = useMemo<BirdOption[]>(() => {
    const supported = new Set<BirdType>(enabledTypes);

    return (enabledCatalog as BirdCatalogRow[])
      .filter((row) => row.visible) // ✅ visible gate
      .filter((row) => supported.has(row.id as BirdType)) // ✅ engine-safe gate
      .map((row) => ({
        id: row.id as BirdType,
        title: row.displayLabel,
        subtitle: row.availabilityNotes ?? "",
        imgSrc: row.imgSrc || "/birds/homing-pigeon.gif",
        recommended: row.id === "pigeon",
      }));
  }, [enabledCatalog, enabledTypes]);

  // ✅ Coming soon = visible:true + enabled:false (NOT engine constrained)
  const futureFowls = useMemo<FutureBirdOption[]>(() => {
    return (BIRD_CATALOG as BirdCatalogRow[])
      .filter((row) => row.visible) // ✅ visible gate
      .filter((row) => !row.enabled) // ✅ NOT enabled => coming soon
      .map((row) => ({
        id: row.id,
        title: row.displayLabel,
        subtitle: row.availabilityNotes ?? "Coming soon",
        imgSrc: row.imgSrc || "/birds/homing-pigeon.gif",
      }));
  }, []);

  // ✅ selected bird (default: pigeon if available, else first enabled)
  const [bird, setBird] = useState<BirdType>(() => {
    if (enabledTypes.includes("pigeon")) return "pigeon";
    return (enabledTypes[0] ?? "pigeon") as BirdType;
  });
  const [showWriteOn, setShowWriteOn] = useState(false);

  // ✅ intermittent shake state
  const [shake, setShake] = useState(false);
  const shakeIntervalRef = useRef<number | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);

  // ✅ tiny toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (shakeIntervalRef.current) window.clearInterval(shakeIntervalRef.current);
      if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current);
    };
  }, []);

  const go = (b: BirdType) => {
    // ✅ safety: only allow enabled BirdTypes
    if (!enabledTypes.includes(b)) {
      showToast("That bird isn’t enabled yet.");
      return;
    }
    router.push(`/write?bird=${encodeURIComponent(b)}`);
  };

  // ✅ Per-bird CTA text (easy to tweak later)
  const ctaTextFor = (b: BirdType) => {
    switch (b) {
      case "goose":
        return "Honk & Send";
      case "snipe":
        return "Snipe & Swipe";
      case "pigeon":
      default:
        return "Let it Fly";
    }
  };

  // ✅ start/stop the "shake every 5s" loop when the button is visible
  useEffect(() => {
    if (shakeIntervalRef.current) window.clearInterval(shakeIntervalRef.current);
    if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current);
    setShake(false);

    if (!showWriteOn) return;

    const pulse = () => {
      setShake(true);
      if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current);
      shakeTimeoutRef.current = window.setTimeout(() => setShake(false), 650);
    };

    const initial = window.setTimeout(() => pulse(), 800);
    shakeTimeoutRef.current = initial as unknown as number;

    shakeIntervalRef.current = window.setInterval(pulse, 5000);

    return () => {
      if (shakeIntervalRef.current) window.clearInterval(shakeIntervalRef.current);
      if (shakeTimeoutRef.current) window.clearTimeout(shakeTimeoutRef.current);
      setShake(false);
    };
  }, [showWriteOn]);

  return (
    <main className="pageBg">
      <div className="wrap" style={{ paddingTop: 12, position: "relative" }}>
        <Link href="/" className="linkPill">
          ← Home
        </Link>

        <div style={{ marginTop: 12 }}>
          <div className="kicker">Compose</div>
          <h1 className="h1">Choose a bird</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            How should this message travel?
          </p>
          <p className="muted" style={{ marginTop: 6, fontSize: 14, opacity: 0.8 }}>
            You can change this later.
          </p>
        </div>

        {/* Current birds (enabled + visible + supported by engine) */}
        <div className="birdGrid">
          {options.map((opt) => {
            const isSelected = bird === opt.id;

            return (
              <div key={opt.id} className="birdPick">
                <button
                  type="button"
                  className={`card birdCard ${isSelected ? "on" : ""}`}
                  onClick={() => {
                    if (isSelected) setShowWriteOn((v) => !v);
                    else {
                      setBird(opt.id);
                      setShowWriteOn(true);
                    }
                  }}
                  aria-pressed={isSelected}
                  style={{ position: "relative" }}
                  title={`Choose ${opt.title}`}
                >
                  {isSelected && (
                    <div className="birdBadge" aria-hidden="true">
                      ✓
                    </div>
                  )}

                  {/* Recommended pill */}
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

                {/* Pop-up button beneath the selected card (toggle-able) */}
                {isSelected && showWriteOn && (
                  <button
                    type="button"
                    className={`btnPrimary writeOnBtn ${shake ? "shakeNow" : ""}`}
                    onClick={() => go(opt.id)}
                    title="Write your letter"
                  >
                    {ctaTextFor(opt.id)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Future Fowls (visible + enabled:false) */}
        <div style={{ marginTop: 14 }}>
          <div className="kicker">Coming soon</div>
          <h2 className="h2" style={{ marginTop: 6 }}>
            Future Fowls
          </h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Not selectable yet. The roster is… evolving.
          </p>

          <div className="birdGrid" style={{ marginTop: 10 }}>
            {futureFowls.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="card birdCard futureCard"
                aria-disabled="true"
                title={`${opt.title} (Coming soon)`}
                onClick={(e) => {
                  e.preventDefault();
                  showToast("Coming soon — Future Fowls aren’t selectable yet.");
                }}
              >
                <div className="birdRec futurePill" aria-hidden="true">
                  Coming soon
                </div>

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
            ))}
          </div>

          <div className="muted" style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            More birds are molting.
          </div>
        </div>

        {/* Continue / Skip */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sendRow">
            <button onClick={() => go(bird)} className="btnPrimary">
              Continue to write
            </button>

            <button
              onClick={() => go("pigeon")}
              className="btnGhost"
              disabled={!enabledTypes.includes("pigeon")}
              title={!enabledTypes.includes("pigeon") ? "Pigeon isn’t enabled" : "Use pigeon"}
            >
              Skip — use pigeon
            </button>
          </div>
        </div>

        {/* Toast UI */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            onClick={() => setToast(null)}
            style={{
              position: "fixed",
              left: "50%",
              bottom: 18,
              transform: "translateX(-50%)",
              zIndex: 9999,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.88)",
              color: "white",
              fontSize: 13,
              lineHeight: "16px",
              maxWidth: 520,
              width: "calc(100% - 24px)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              cursor: "pointer",
              userSelect: "none",
            }}
            title="Click to dismiss"
          >
            {toast}
            <span style={{ opacity: 0.65, marginLeft: 8 }}>(tap to dismiss)</span>
          </div>
        )}

        <style jsx global>{`
          .birdPick {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .writeOnBtn {
            width: 100%;
            border-radius: 14px;
            padding: 12px 14px;
            font-weight: 900;
            letter-spacing: -0.01em;
            animation: popIn 160ms ease-out;
            will-change: transform;
          }

          @keyframes popIn {
            from {
              transform: translateY(-6px);
              opacity: 0;
            }
            to {
              transform: translateY(0px);
              opacity: 1;
            }
          }

          .shakeNow {
            animation: popIn 160ms ease-out, shake 520ms ease-in-out;
          }

          @keyframes shake {
            0% {
              transform: translateX(0) rotate(0deg);
            }
            12% {
              transform: translateX(-2px) rotate(-0.5deg);
            }
            25% {
              transform: translateX(3px) rotate(0.6deg);
            }
            38% {
              transform: translateX(-3px) rotate(-0.6deg);
            }
            52% {
              transform: translateX(2px) rotate(0.4deg);
            }
            68% {
              transform: translateX(-1px) rotate(-0.2deg);
            }
            100% {
              transform: translateX(0) rotate(0deg);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .writeOnBtn,
            .shakeNow {
              animation: none !important;
            }
          }

          .birdCard {
            position: relative;
          }

          .birdCard .birdThumb {
            position: relative;
            z-index: 1;
          }

          .birdCard .birdRec,
          .birdCard .birdBadge {
            z-index: 5;
          }

          .futureCard {
            position: relative;
            cursor: pointer;
          }

          .futurePill {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 5;
            pointer-events: none;
          }

          .futureCard .birdThumb img {
            filter: saturate(0.3) contrast(1.02) brightness(0.98);
            transition: filter 180ms ease, transform 180ms ease;
            transform: translateZ(0);
          }

          .futureCard:hover .birdThumb img,
          .futureCard:focus-visible .birdThumb img {
            filter: saturate(1) contrast(1) brightness(1);
          }

          .birdCard:not(.on) .birdThumb img {
            filter: saturate(0.35) contrast(1.02) brightness(0.98);
            transition: filter 180ms ease, transform 180ms ease;
            transform: translateZ(0);
          }

          .birdCard:not(.on) .birdTitle {
            opacity: 0.88;
            transition: opacity 180ms ease;
          }
          .birdCard:not(.on) .birdSub {
            opacity: 0.7;
            transition: opacity 180ms ease;
          }

          .birdCard:not(.on):hover .birdThumb img,
          .birdCard:not(.on):focus-visible .birdThumb img {
            filter: saturate(1) contrast(1) brightness(1);
            transform: scale(1.02);
          }

          .birdCard:not(.on):hover .birdTitle,
          .birdCard:not(.on):focus-visible .birdTitle {
            opacity: 1;
          }
          .birdCard:not(.on):hover .birdSub,
          .birdCard:not(.on):focus-visible .birdSub {
            opacity: 0.9;
          }

          .birdCard.on .birdThumb img {
            filter: none;
            transform: none;
          }

          .birdCard.on .birdTitle,
          .birdCard.on .birdSub {
            opacity: 1;
          }
        `}</style>
      </div>
    </main>
  );
}