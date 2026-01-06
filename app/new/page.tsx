"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type BirdType = "pigeon" | "snipe" | "goose";

type BirdOption = {
  id: BirdType;
  title: string;
  subtitle: string;
  emoji: string;
  imgSrc: string; // placeholder paths
};

export default function NewPage() {
  const router = useRouter();
  const [bird, setBird] = useState<BirdType>("pigeon");

  const go = (b: BirdType) => router.push(`/write?bird=${b}`);

  const options = useMemo<BirdOption[]>(
    () => [
      {
        id: "snipe",
        title: "🏎️ Great Snipe",
        subtitle: "Fast long-haul. No roosting.",
        emoji: "🏎️",
        imgSrc: "/birds/great-snipe.png",
      },
      {
        id: "pigeon",
        title: "🕊️ Homing Pigeon",
        subtitle: "Classic delivery.",
        emoji: "🕊️",
        imgSrc: "/birds/homing-pigeon.png",
      },
      {
        id: "goose",
        title: "🪿 Canada Goose",
        subtitle: "Carries more. Slower.",
        emoji: "🪿",
        imgSrc: "/birds/canada-goose.png",
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

        {/* Bird cards */}
        <div className="birdGrid">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`card birdCard ${bird === opt.id ? "on" : ""}`}
              onClick={() => setBird(opt.id)}
              aria-pressed={bird === opt.id}
            >
              <div className="birdRow">
                <div className="birdThumb" aria-hidden="true">
                  <img src={opt.imgSrc} alt="" />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="birdTitle">{opt.title}</div>
                  <div className={`muted birdSub`}>{opt.subtitle}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Continue / Skip (unchanged) */}
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