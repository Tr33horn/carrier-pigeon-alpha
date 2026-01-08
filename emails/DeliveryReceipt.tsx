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
  statusUrl: string; // absolute preferred
  deliveredAtUtc: string;
  bird?: BirdType | null;
}) {
  return (
    <EmailLayout preview="Delivery receipt confirmed.">
      {/* Bird */}
      <BirdStateImage
        bird={bird ?? undefined}
        state="landed"
        alt="Courier landed"
      />

      <Text
        style={{
          fontSize: 18,
          fontWeight: 800,
          margin: "0 0 10px",
          textAlign: "center",
        }}
      >
        Delivery confirmed ✅
      </Text>

      <Text style={{ margin: "0 0 12px", textAlign: "center" }}>
        Your letter to{" "}
        <strong>{toName || "the recipient"}</strong> has been delivered.
      </Text>

      <Text style={{ margin: "0 0 18px", color: "#444", textAlign: "center" }}>
        Delivered (UTC): <strong>{deliveredAtUtc}</strong>
      </Text>

      <Section style={{ textAlign: "center", marginTop: 8 }}>
        <Button
          href={statusUrl}
          style={{
            backgroundColor: "#111",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            display: "inline-block",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          View flight status
        </Button>
      </Section>

      <Text
        style={{
          fontSize: 12,
          color: "#666",
          marginTop: 18,
          textAlign: "center",
        }}
      >
        Your courier has been compensated in snacks.
      </Text>
    </EmailLayout>
  );
}

/**
 * ✅ Required for React Email preview sidebar
 * This does NOT affect production email sending
 */
export default function Preview() {
  return (
    <DeliveryReceiptEmail
      toName="Greggor"
      statusUrl="https://carrier-pigeon-alpha.vercel.app/l/demo-token"
      deliveredAtUtc="2026-01-07 21:42 UTC"
      bird="pigeon"
    />
  );
}