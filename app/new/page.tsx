"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BirdType = "pigeon" | "snipe" | "goose";

export default function NewPage() {
  const router = useRouter();
  const [bird, setBird] = useState<BirdType>("pigeon");

  const go = (b: BirdType) => router.push(`/write?bird=${b}`);

  const labelStyle: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    cursor: "pointer",
  };

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

        <div className="card" style={{ marginTop: 14 }}>
          <div className="stack" style={{ gap: 12 }}>
            <label style={labelStyle}>
              <input
                type="radio"
                name="bird"
                checked={bird === "snipe"}
                onChange={() => setBird("snipe")}
                style={{ marginTop: 4 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>🏎️ Great Snipe</div>
                <div className="muted">Fast long-haul. No roosting.</div>
              </div>
            </label>

            <label style={labelStyle}>
              <input
                type="radio"
                name="bird"
                checked={bird === "pigeon"}
                onChange={() => setBird("pigeon")}
                style={{ marginTop: 4 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>🕊️ Homing Pigeon</div>
                <div className="muted">Classic delivery.</div>
              </div>
            </label>

            <label style={labelStyle}>
              <input
                type="radio"
                name="bird"
                checked={bird === "goose"}
                onChange={() => setBird("goose")}
                style={{ marginTop: 4 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>🪿 Canada Goose</div>
                <div className="muted">Carries more. Slower.</div>
              </div>
            </label>
          </div>

          <div className="sendRow" style={{ marginTop: 16 }}>
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