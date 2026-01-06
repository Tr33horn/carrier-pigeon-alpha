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
  imgSrc: string; // placeholder for now
};

function BirdCard({
  option,
  selected,
  onSelect,
}: {
  option: BirdOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="card"
      aria-pressed={selected}
      style={{
        textAlign: "left",
        width: "100%",
        cursor: "pointer",
        padding: 14,
        border: selected ? "2px solid rgba(255,255,255,0.35)" : undefined, // subtle, non-invasive
        boxShadow: selected ? "0 0 0 3px rgba(0,0,0,0.12) inset" : undefined,
        transform: selected ? "translateY(-1px)" : undefined,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 96,
            height: 72,
            borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            flex: "0 0 auto",
          }}
        >
          {/* Placeholder image. Swap to next/image later if you want. */}
          <img
            src={option.imgSrc}
            alt={option.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
            <span>{option.emoji}</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {option.title}
            </span>
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {option.subtitle}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function NewPage() {
  const router = useRouter();
  const [bird, setBird] = useState<BirdType>("pigeon");

  const options = useMemo<BirdOption[]>(
    () => [
      {
        id: "snipe",
        title: "Great Snipe",
        subtitle: "Fast long-haul. No roosting.",
        emoji: "🏎️",
        imgSrc: "/birds/great-snipe.jpg", // placeholder path
      },
      {
        id: "pigeon",
        title: "Homing Pigeon",
        subtitle: "Classic delivery.",
        emoji: "🕊️",
        imgSrc: "/birds/homing-pigeon.jpg", // placeholder path
      },
      {
        id: "goose",
        title: "Canada Goose",
        subtitle: "Carries more. Slower.",
        emoji: "🪿",
        imgSrc: "/birds/canada-goose.jpg", // placeholder path
      },
    ],
    []
  );

  const go = (b: BirdType) => router.push(`/write?bird=${b}`);

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

        {/* Grid row of bird cards */}
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {options.map((opt) => (
              <BirdCard
                key={opt.id}
                option={opt}
                selected={bird === opt.id}
                onSelect={() => setBird(opt.id)}
              />
            ))}
          </div>

          {/* Mobile fallback: stack */}
          <style jsx>{`
            @media (max-width: 820px) {
              div[style*="grid-template-columns: repeat(3"] {
                grid-template-columns: 1fr;
              }
            }
          `}</style>
        </div>

        {/* Bottom actions (kept as-is) */}
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