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

function safeBaseUrl() {
  const b = (APP_URL || "").trim();
  return b || "https://pigeon.humanrobotalliance.com";
}

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

export function LetterOnTheWayEmail({
  toName,
  fromName,
  statusUrl,
  originName,
  destName,
  etaTextUtc,
  bird,
  debugToken,
}: {
  toName?: string | null;
  fromName?: string | null;
  statusUrl: string; // path or absolute
  originName: string;
  destName: string;
  etaTextUtc: string;
  bird?: BirdType | null;
  debugToken?: string | null; // public_token
}) {
  const href = joinUrl(safeBaseUrl(), statusUrl);

  return (
    <EmailLayout preview="A letter is on the way.">
      {debugToken ? (
        <>
          {/* X-FLOK-TOKEN: {debugToken} */}
          <Text style={{ fontSize: 1, lineHeight: "1px", margin: 0, color: "#ffffff" }}>
            X-FLOK-TOKEN:{debugToken}
          </Text>
        </>
      ) : null}

      <BirdStateImage bird={bird ?? undefined} state="fly" alt="Courier in flight" />

      <Text style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px", textAlign: "center" }}>
        A letter is on the way.
      </Text>

      <Text style={{ margin: "0 0 14px", textAlign: "center" }}>
        Hey {toName || "there"} — <strong>{fromName || "someone"}</strong> sent you a letter.
        <br />
        It stays sealed until delivery.
      </Text>

      <Text style={{ margin: "0 0 14px", color: "#444", textAlign: "center" }}>
        Route: <strong>{originName}</strong> → <strong>{destName}</strong>
        <br />
        ETA (UTC): <strong>{etaTextUtc}</strong>
      </Text>

      <Section style={{ textAlign: "center", marginTop: 10 }}>
        <Button href={href} style={BUTTON}>
          Track the flight
        </Button>
      </Section>

      <Text style={{ fontSize: 12, color: "#666", marginTop: 18, textAlign: "center" }}>
        No peeking. The bird has a union.
      </Text>
    </EmailLayout>
  );
}

export default function Preview() {
  return (
    <LetterOnTheWayEmail
      toName="Greggor"
      fromName="Mystery Sender"
      statusUrl="/l/demo-token"
      originName="Snoqualmie, WA"
      destName="Austin, TX"
      etaTextUtc="2026-01-08 02:30 UTC"
      bird="snipe"
      debugToken="demo-token"
    />
  );
}