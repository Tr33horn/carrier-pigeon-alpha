import * as React from "react";
import { Button, Section, Text } from "@react-email/components";
import { EmailLayout } from "./components/Layout";
import { BirdStateImage, type BirdType } from "./components/BirdStateImage";

export function DeliveryReceiptEmail({
  toName,
  statusUrl,
  deliveredAtUtc,
  bird,
}: {
  toName?: string | null;
  statusUrl: string; // absolute preferred (cron will pass absolute)
  deliveredAtUtc: string;
  bird?: BirdType | null;
}) {
  return (
    <EmailLayout preview="Delivery receipt confirmed.">
      <BirdStateImage bird={bird ?? undefined} state="landed" alt="Courier landed" />

      <Text style={{ fontSize: 18, fontWeight: 800, margin: "6px 0 8px" }}>
        Delivery confirmed ✅
      </Text>

      <Text style={{ margin: "0 0 12px" }}>
        Your letter to <strong>{toName || "the recipient"}</strong> has been delivered.
      </Text>

      <Text style={{ margin: "0 0 14px", color: "#444" }}>
        Delivered (UTC): <strong>{deliveredAtUtc}</strong>
      </Text>

      <Section style={{ marginTop: 12 }}>
        <Button
          href={statusUrl}
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
          View flight status
        </Button>
      </Section>

      <Text style={{ fontSize: 12, color: "#666", marginTop: 16 }}>
        Your courier has been compensated in snacks.
      </Text>
    </EmailLayout>
  );
}