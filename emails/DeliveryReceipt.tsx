import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "./components/Layout";
import { BirdStateImage, type BirdType } from "./components/BirdStateImage";

const BUTTON = {
  backgroundColor: "#111",
  color: "#fff",
  padding: "12px 18px",
  borderRadius: 14,
  display: "inline-block",
  textDecoration: "none",
  fontWeight: 700,
  letterSpacing: "-0.01em",
} as const;

export function DeliveryReceiptEmail({
  toName,
  statusUrl,
  deliveredAtUtc,
  bird,
}: {
  toName?: string | null;
  statusUrl: string; // absolute preferred
  deliveredAtUtc: string;
  bird?: BirdType | null;
}) {
  return (
    <EmailLayout preview="Delivery receipt confirmed.">
      <BirdStateImage bird={bird ?? undefined} state="landed" alt="Courier landed" />

      <Text style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px", textAlign: "center" }}>
        Delivery confirmed ✅
      </Text>

      <Text style={{ margin: "0 0 14px", textAlign: "center" }}>
        Your letter to <strong>{toName || "the recipient"}</strong> has been delivered.
      </Text>

      <Text style={{ margin: "0 0 14px", color: "#444", textAlign: "center" }}>
        Delivered (UTC): <strong>{deliveredAtUtc}</strong>
      </Text>

      <Section style={{ textAlign: "center", marginTop: 10 }}>
        <Button href={statusUrl} style={BUTTON}>
          View flight status
        </Button>
      </Section>

      <Text style={{ fontSize: 12, color: "#666", marginTop: 18, textAlign: "center" }}>
        Your courier has been compensated in snacks.
      </Text>
    </EmailLayout>
  );
}