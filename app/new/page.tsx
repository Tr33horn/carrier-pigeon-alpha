"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BirdType = "pigeon" | "hummingbird" | "stork";

export default function NewPage() {
  const router = useRouter();
  const [bird, setBird] = useState<BirdType>("pigeon");

  const go = (b: BirdType) => router.push(`/write?bird=${b}`);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <p>
        <a href="/" style={{ textDecoration: "none" }}>← Home</a>
      </p>

      <h1 style={{ marginTop: 8 }}>Choose a bird</h1>
      <p style={{ opacity: 0.8, marginTop: 6 }}>How should this message travel?</p>
      <p style={{ opacity: 0.7, marginTop: 6, fontSize: 14 }}>You can change this later.</p>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
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
            <div style={{ opacity: 0.8 }}>The classic delivery.</div>
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
            <div style={{ opacity: 0.8 }}>Faster delivery.</div>
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
            <div style={{ opacity: 0.8 }}>Carries more.</div>
          </div>
        </label>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => go(bird)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: "pointer",
          }}
        >
          Continue to write
        </button>

        <button
          onClick={() => go("pigeon")}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.2)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Skip — use pigeon
        </button>
      </div>
    </main>
  );
}



