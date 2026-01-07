import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { APP_URL } from "@/app/lib/email/config";
import { EmailLayout } from "./components/Layout";
import { BirdStateImage, type BirdType } from "./components/BirdStateImage";

function joinUrl(base: string, pathOrUrl: string) {
  if (!pathOrUrl) return base;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
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
    <EmailLayout preview="A letter is on the way.">
      <BirdStateImage bird={bird ?? undefined} state="fly" alt="Courier in flight" />

      <Text style={{ fontSize: 18, fontWeight: 800, margin: "6px 0 8px" }}>
        A letter is on the way.
      </Text>

      <Text style={{ margin: "0 0 10px" }}>
        Hey {toName || "there"} — <strong>{fromName || "someone"}</strong> sent you a letter.
        It stays sealed until delivery.
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
        No peeking. The bird has a union.
      </Text>
    </EmailLayout>
  );
}