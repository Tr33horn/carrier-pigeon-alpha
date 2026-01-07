import * as React from "react";
import { Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import { APP_URL, BRAND } from "@/app/lib/email/config";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>

      <Section style={{ backgroundColor: "#f6f7fb", padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 20 }}>
          <Section style={{ marginBottom: 12 }}>
            <Img
              src={BRAND.logoUrl}
              alt={BRAND.name}
              width={120}
              style={{
                display: "block",
                maxWidth: "100%",
                height: "auto",
              }}
            />
          </Section>

          {children}

          <Section style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #eee" }}>
            <Text style={{ fontSize: 12, color: "#666", margin: 0 }}>
              Sent by {BRAND.name}.{" "}
              <Link href={APP_URL} style={{ color: "#111" }}>
                Open FLOK
              </Link>
            </Text>
          </Section>
        </Container>
      </Section>
    </Html>
  );
}