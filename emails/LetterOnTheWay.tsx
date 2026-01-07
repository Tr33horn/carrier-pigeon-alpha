import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { APP_URL, BRAND } from "@/app/lib/email/config";
import { EmailLayout } from "./components/Layout";

export function LetterOnTheWayEmail({
  toName,
  fromName,
  statusUrl,
  originName,
  destName,
  etaTextUtc,
}: {
  toName?: string | null;
  fromName?: string | null;
  statusUrl: string; // full URL or path; we’ll normalize below
  originName: string;
  destName: string;
  etaTextUtc: string;
}) {
  const href = statusUrl.startsWith("http") ? statusUrl : `${APP_URL}${statusUrl}`;

  return (
    <EmailLayout preview="A letter is on the way.">
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