import * as React from "react";
import {
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { APP_URL, BRAND } from "@/app/lib/email/config";

/** Ensure all email image URLs are absolute */
function toAbsoluteUrl(src?: string) {
  if (!src) return undefined;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  const base = APP_URL.endsWith("/") ? APP_URL.slice(0, -1) : APP_URL;
  const path = src.startsWith("/") ? src : `/${src}`;
  return `${base}${path}`;
}

export function EmailLayout({
  preview,
  children,
  heroSrc,
  heroAlt,
}: {
  preview: string;
  children: React.ReactNode;
  heroSrc?: string;
  heroAlt?: string;
}) {
  const logoSrc = toAbsoluteUrl(BRAND.logoUrl);
  const heroImageSrc = toAbsoluteUrl(heroSrc);

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>

      <Section style={{ backgroundColor: "#f6f7fb", padding: "24px 0" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 14,
            padding: 20,
          }}
        >
          {/* Brand */}
          <Section style={{ marginBottom: 12 }}>
            <Img
              src={logoSrc}
              width="120"
              height="auto"
              alt={BRAND.name}
              style={{ display: "block" }}
            />
          </Section>

          {/* Hero image (bird state) */}
          {heroImageSrc ? (
            <Section style={{ margin: "8px 0 14px" }}>
              <Img
                src={heroImageSrc}
                width="160"
                height="160"
                alt={heroAlt || "Courier status"}
                style={{
                  display: "block",
                  borderRadius: 14,
                  border: "1px solid #eee",
                  backgroundColor: "#fafafa",
                }}
              />
            </Section>
          ) : null}

          {children}

          {/* Footer */}
          <Section
            style={{
              marginTop: 20,
              paddingTop: 14,
              borderTop: "1px solid #eee",
            }}
          >
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