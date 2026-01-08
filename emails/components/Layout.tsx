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

function joinUrl(base: string, pathOrUrl: string) {
  if (!pathOrUrl) return base;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
}

const styles = {
  page: {
    backgroundColor: "#f7f4ee", // warm paper
    padding: "36px 0",
  } as const,

  container: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 28,
    textAlign: "center" as const,
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  } as const,

  headerLogo: {
    margin: "0 auto",
    display: "block",
  } as const,

  heroWrap: {
    margin: "14px 0 18px",
    textAlign: "center" as const,
  } as const,

  heroImg: {
    margin: "0 auto",
    display: "block",
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.06)",
    backgroundColor: "#fbfaf7",
  } as const,

  content: {
    textAlign: "center" as const,
    padding: "2px 2px 0",
  } as const,

  // This is the “Apple Notes” text baseline
  bodyText: {
    fontSize: 16,
    lineHeight: "26px",
    color: "#222",
    margin: "0 0 14px",
  } as const,

  footer: {
    marginTop: 26,
    paddingTop: 18,
    borderTop: "1px solid rgba(0,0,0,0.08)",
    textAlign: "center" as const,
  } as const,

  footerStamp: {
    margin: "0 auto 10px",
    display: "block",
    opacity: 0.92,
  } as const,

  footerFine: {
    fontSize: 12,
    lineHeight: "18px",
    color: "#666",
    margin: 0,
  } as const,

  footerTagline: {
    fontSize: 12,
    lineHeight: "18px",
    color: "#8a8072", // warm gray
    margin: "6px 0 0",
  } as const,
};

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
  const headerLogoSrc = joinUrl(APP_URL, "/brand/flok-mark.png");
  const footerStampSrc = joinUrl(APP_URL, "/brand/flok-stamp.png");
  const heroAbs = heroSrc ? joinUrl(APP_URL, heroSrc) : null;

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>

      <Section style={styles.page}>
        <Container style={styles.container}>
          {/* Header logo */}
          <Section style={{ marginBottom: 16 }}>
            <Img src={headerLogoSrc} width="140" alt={BRAND.name} style={styles.headerLogo} />
          </Section>

          {/* Optional hero (centered, smaller) */}
          {heroAbs ? (
            <Section style={styles.heroWrap}>
              <Img
                src={heroAbs}
                width="220"
                height="220"
                alt={heroAlt || "Courier status"}
                style={styles.heroImg}
              />
            </Section>
          ) : null}

          {/* Main content */}
          <Section style={styles.content}>{children}</Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Img src={footerStampSrc} width="56" alt="Flock stamp" style={styles.footerStamp} />

            <Text style={styles.footerFine}>
              Sent by {BRAND.name}.{" "}
              <Link href={APP_URL} style={{ color: "#111", textDecoration: "underline" }}>
                Open {BRAND.name}
              </Link>
            </Text>

            <Text style={styles.footerTagline}>Slow mail. Fast feelings.</Text>
          </Section>
        </Container>
      </Section>
    </Html>
  );
}

// Handy export if you want consistent copy styling everywhere
export const EMAIL_TEXT = styles.bodyText;