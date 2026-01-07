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

export function LetterProgressUpdateEmail({
  milestone,
  pct,
  fromName,
  statusUrl,
  etaTextUtc,
  funLine,
  bird,
}: {
  milestone: 25 | 50 | 75;
  pct: number;
  fromName?: string | null;
  statusUrl: string; // path or absolute
  etaTextUtc: string;
  funLine: string;
  bird?: BirdType | null;
}) {
  const href = joinUrl(APP_URL, statusUrl);

  const preview =
    milestone === 25 ? "25% of the way there." : milestone === 50 ? "Halfway there." : "75% complete (incoming).";

  const title =
    milestone === 25 ? "Update: 25%" : milestone === 50 ? "Update: 50%" : "Update: 75%";

  return (
    <EmailLayout preview={preview}>
      <BirdStateImage bird={bird ?? undefined} state="fly" alt="Courier in flight" />

      <Text style={{ fontSize: 18, fontWeight: 800, margin: "6px 0 8px" }}>
        {title}
      </Text>

      <Text style={{ margin: "0 0 10px" }}>
        Your sealed letter from <strong>{fromName || "someone"}</strong> is still in flight.
      </Text>

      <Text style={{ margin: "0 0 12px", color: "#444" }}>
        ETA (UTC): <strong>{etaTextUtc}</strong>
      </Text>

      <Text style={{ margin: "0 0 14px", color: "#444" }}>
        <em>{funLine}</em>
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
          Check flight status ({pct}%)
        </Button>
      </Section>

      <Text style={{ fontSize: 12, color: "#666", marginTop: 16 }}>
        Still sealed. Still mysterious.
      </Text>
    </EmailLayout>
  );
}