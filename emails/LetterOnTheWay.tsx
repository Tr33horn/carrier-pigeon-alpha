import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { APP_URL } from "@/app/lib/email/config";
import { EmailLayout } from "./components/Layout";

type BirdType = "pigeon" | "snipe" | "goose";
type BirdState = "fly" | "sleep" | "landed";

function joinUrl(base: string, pathOrUrl: string) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
}

function birdBase(bird?: BirdType) {
  if (bird === "snipe") return "great-snipe";
  if (bird === "goose") return "canada-goose";
  return "homing-pigeon";
}

/**
 * Email-safe bird image selector.
 * Matches your actual PNG assets in /public/birds
 */
function birdHero(bird?: BirdType, state: BirdState = "fly") {
  const base = birdBase(bird);
  return `/birds/${base}-${state}.png`;
}

export function LetterOnTheWayEmail({
  toName,
  fromName,
  statusUrl,
  originName,
  destName,
  etaTextUtc,
  bird,
}: {
  toName?: string | null;
  fromName?: string | null;
  statusUrl: string; // path or absolute
  originName: string;
  destName: string;
  etaTextUtc: string;
  bird?: BirdType | null;
}) {
  const href = joinUrl(APP_URL, statusUrl);

  return (
    <EmailLayout
      preview="A letter is on the way."
      heroSrc={birdHero(bird ?? undefined, "fly")}
      heroAlt="Courier in flight"
    >
      <Text style={{ fontSize: 18, fontWeight: 800, margin: "6px 0 8px" }}>
        A letter is on the way.
      </Text>

      <Text style={{ margin: "0 0 10px" }}>
        Hey {toName || "there"} — {fromName || "someone"} sent you a letter.
      </Text>

      <Text style={{ margin: "0 0 14px", color: "#444" }}>
        Route: <strong>{originName}</strong> → <strong>{destName}</strong>
        <br />
        ETA (UTC): <strong>{etaTextUtc}</strong>
      </Text>

      <Section style={{ marginTop: 12 }}>
        <Button
          href={href}
          style={{
            backgroundColor: "#111",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: 10,
            display: "inline-block",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Track the flight
        </Button>
      </Section>

      <Text style={{ fontSize: 12, color: "#666", marginTop: 16 }}>
        The long way home. Messages delivered with patience.
      </Text>
    </EmailLayout>
  );
}