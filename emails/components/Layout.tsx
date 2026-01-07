import * as React from "react";
import { Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components";
import { APP_URL, BRAND } from "@/app/lib/email/config";

function joinUrl(base: string, pathOrUrl: string) {
  if (!pathOrUrl) return base;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
}

export function EmailLayout({
  preview,
  children,
  heroSrc,
  heroAlt,
}: {
  preview: string;
  children: React.ReactNode;
  heroSrc?: string; // path OR absolute
  heroAlt?: string;
}) {
  const logoSrc = joinUrl(APP_URL, BRAND.logoUrl); // supports if BRAND.logoUrl is already absolute
  const heroAbs = heroSrc ? joinUrl(APP_URL, heroSrc) : null;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>

      <Section style={{ backgroundColor: "#f6f7fb", padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 20 }}>
          {/* Logo */}
          <Section style={{ marginBottom: 12 }}>
            <Img
              src={logoSrc}
              width="120"
              alt={BRAND.name}
              style={{ display: "block" }}
            />
          </Section>

          {/* Optional hero */}
          {heroAbs ? (
            <Section style={{ margin: "8px 0 14px" }}>
              <Img
                src={heroAbs}
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
          <Section style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #eee" }}>
            <Text style={{ fontSize: 12, color: "#666", margin: 0 }}>
              Sent by {BRAND.name}.{" "}
              <Link href={APP_URL} style={{ color: "#111" }}>
                Open {BRAND.name}
              </Link>
            </Text>

            <Text style={{ fontSize: 12, color: "#999", margin: "6px 0 0" }}>
              Slow mail. Fast feelings.
            </Text>
          </Section>
        </Container>
      </Section>
    </Html>
  );
}