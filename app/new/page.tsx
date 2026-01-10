"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type BirdType = "pigeon" | "snipe" | "goose";

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
  const [bird, setBird] = useState<BirdType>("pigeon");

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
    };
  }, []);

  const go = (b: BirdType) => router.push(`/write?bird=${encodeURIComponent(b)}`);

  const options = useMemo<BirdOption[]>(
    () => [
      {
        id: "snipe",
        title: "Great Snipe",
        subtitle: "Fast long-haul. No roosting.",
        imgSrc: "/birds/great-snipe.gif",
      },
      {
        id: "pigeon",
        title: "Homing Pigeon",
        subtitle: "Classic delivery.",
        imgSrc: "/birds/homing-pigeon.gif",
        recommended: true,
      },
      {
        id: "goose",
        title: "Canada Goose",
        subtitle: "Carries more. Slower.",
        imgSrc: "/birds/canada-goose.gif",
      },
    ],
    []
  );

  // ✅ Future Fowls (2 rows = 6 cards)
  const futureFowls = useMemo<FutureBirdOption[]>(
    () => [
      // Row 1
      {
        id: "peregrine-falcon",
        title: "Peregrine Falcon",
        subtitle: "The airborne missile (politely).",
        imgSrc: "/birds/Peregrine-Falcon.gif",
      },
      {
        id: "annas-hummingbird",
        title: "Anna’s Hummingbird",
        subtitle: "Tiny bird. Unhinged acceleration.",
        imgSrc: "/birds/AnnasHummingbird.gif",
      },
      {
        id: "white-throated-needletail",
        title: "White-throated Needletail",
        subtitle: "Blink-and-it’s-delivered speed.",
        imgSrc: "/birds/white-throated-needletail.gif",
      },

      // Row 2
      {
        id: "american-osprey",
        title: "American Osprey",
        subtitle: "Precision strikes. Fish not included.",
        imgSrc: "/birds/American-Osprey.gif",
      },
      {
        id: "northern-hawk-owl",
        title: "Northern Hawk Owl",
        subtitle: "Daylight hunter. Night-owl energy.",
        imgSrc: "/birds/NorthernHawkOwl.gif",
      },
      {
        id: "common-tern",
        title: "Common Tern",
        subtitle: "Coastal courier with stamina.",
        imgSrc: "/birds/CommonTern.gif",
      },
    ],
    []
  );

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

        {/* Current birds */}
        <div className="birdGrid">
          {options.map((opt) => {
            const isSelected = bird === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                className={`card birdCard ${isSelected ? "on" : ""}`}
                onClick={() => {
                  setBird(opt.id);
                  go(opt.id);
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

        {/* ✅ Future Fowls */}
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
                className="card birdCard futureFowlCard"
                aria-disabled="true"
                title={`${opt.title} (Coming soon)`}
                onClick={() => showToast("Coming soon — Future Fowls aren’t selectable yet.")}
                style={{
                  position: "relative",
                  opacity: 0.9,
                  cursor: "not-allowed",
                }}
              >
                <div
                  className="birdRec"
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    opacity: 0.95,
                  }}
                >
                  Coming soon
                </div>

                <div className="birdRow">
                  <div className="birdThumb futureFowlThumb" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="futureFowlImg" src={opt.imgSrc} alt="" />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div className="birdTitle">{opt.title}</div>
                    <div className="muted birdSub">{opt.subtitle}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* ✅ Cheeky footer */}
          <div
            className="muted"
            style={{
              marginTop: 10,
              fontSize: 13,
              opacity: 0.75,
            }}
          >
            More birds are molting.
          </div>
        </div>

        {/* Continue / Skip */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sendRow">
            <button onClick={() => go(bird)} className="btnPrimary">
              Continue to write
            </button>

            <button onClick={() => go("pigeon")} className="btnGhost">
              Skip — use pigeon
            </button>
          </div>
        </div>

        {/* ✅ Toast UI */}
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

        {/* ✅ Local styles: grayscale → color hover for Future Fowls */}
        <style jsx>{`
          .futureFowlImg {
            filter: grayscale(1);
            opacity: 0.9;
            transition: filter 180ms ease, opacity 180ms ease, transform 180ms ease;
            transform: translateZ(0);
          }

          .futureFowlCard:hover .futureFowlImg,
          .futureFowlCard:focus-visible .futureFowlImg {
            filter: grayscale(0);
            opacity: 1;
            transform: scale(1.02);
          }

          /* Keep it subtle: don’t let a disabled card feel “clicky” */
          .futureFowlCard:hover,
          .futureFowlCard:focus-visible {
            transform: none;
          }
        `}</style>
      </div>
    </main>
  );
}