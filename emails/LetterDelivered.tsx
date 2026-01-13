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

export function LetterDeliveredEmail({
  toName,
  fromName,
  statusUrl,
  originName,
  destName,
  bird,
}: {
  toName?: string | null;
  fromName?: string | null;
  statusUrl: string; // path or absolute
  originName: string;
  destName: string;
  bird?: BirdType | null;
}) {
  const href = joinUrl(APP_URL, statusUrl);

  return (
    <EmailLayout preview="Your letter has arrived.">
      <BirdStateImage bird={bird ?? undefined} state="landed" alt="Courier landed" />

      <Text style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px", textAlign: "center" }}>
        Delivered ✅
      </Text>

      <Text style={{ margin: "0 0 14px", textAlign: "center" }}>
        Hey {toName || "there"} — your letter from <strong>{fromName || "someone"}</strong> has landed.
      </Text>

      <Text style={{ margin: "0 0 14px", color: "#444", textAlign: "center" }}>
        Route: <strong>{originName}</strong> → <strong>{destName}</strong>
      </Text>

      <Section style={{ textAlign: "center", marginTop: 10 }}>
        <Button href={href} style={BUTTON}>
          Open the letter
        </Button>
      </Section>

      <Text style={{ fontSize: 12, color: "#666", marginTop: 18, textAlign: "center" }}>
        The long way home.
      </Text>
    </EmailLayout>
  );
}

/** ✅ Required for React Email preview sidebar */
export default function Preview() {
  return (
    <LetterDeliveredEmail
      toName="Greggor"
      fromName="The Flock"
      statusUrl="/l/demo-token"
      originName="Seattle, WA"
      destName="New York, NY"
      bird="pigeon"
    />
  );
}