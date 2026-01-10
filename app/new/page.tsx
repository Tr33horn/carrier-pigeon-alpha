"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type BirdType = "pigeon" | "snipe" | "goose";

type BirdOption = {
  id: BirdType;
  title: string;
  subtitle: string;
  imgSrc: string;
  recommended?: boolean;
};

export default function NewPage() {
  const router = useRouter();
  const [bird, setBird] = useState<BirdType>("pigeon");

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

  return (
    <main className="pageBg">
      <div className="wrap" style={{ paddingTop: 12 }}>
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

        {/* Bird cards (click = select + go to write) */}
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
                {/* Selected checkmark (top-right) */}
                {isSelected && (
                  <div className="birdBadge" aria-hidden="true">
                    ✓
                  </div>
                )}

                {/* Recommended pill (top-left) */}
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

        {/* Continue / Skip still works (optional redundancy) */}
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
      </div>
    </main>
  );
}