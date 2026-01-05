"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BirdType = "pigeon" | "hummingbird" | "stork";

export default function NewPage() {
  const router = useRouter();
  const [bird, setBird] = useState<BirdType>("pigeon");

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

        <div className="card" style={{ marginTop: 14 }}>
          <div className="stack" style={{ gap: 12 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="radio"
                name="bird"
                checked={bird === "pigeon"}
                onChange={() => setBird("pigeon")}
                style={{ marginTop: 4 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>🕊️ Carrier Pigeon</div>
                <div className="muted">The classic delivery.</div>
              </div>
            </label>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="radio"
                name="bird"
                checked={bird === "hummingbird"}
                onChange={() => setBird("hummingbird")}
                style={{ marginTop: 4 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>🐦 Hummingbird</div>
                <div className="muted">Faster delivery.</div>
              </div>
            </label>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="radio"
                name="bird"
                checked={bird === "stork"}
                onChange={() => setBird("stork")}
                style={{ marginTop: 4 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>🪿 Stork</div>
                <div className="muted">Carries more.</div>
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