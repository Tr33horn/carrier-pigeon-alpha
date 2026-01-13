import { Button, Section, Text } from "@react-email/components";
import { APP_URL } from "@/app/lib/email/config";
import { EmailLayout } from "./components/Layout";

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

export function LetterStatusLinkResentEmail({
  subject,
  originName,
  destName,
  statusUrl,
}: {
  subject: string;
  originName: string;
  destName: string;
  statusUrl: string; // path or absolute
}) {
  const href = joinUrl(APP_URL, statusUrl);

  return (
    <EmailLayout preview="Your flight status link">
      <Text style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px", textAlign: "center" }}>
        Status link re-sent
      </Text>

      <Text style={{ margin: "0 0 14px", textAlign: "center" }}>
        You asked nicely. We complied.
      </Text>

      <Text style={{ margin: "0 0 14px", fontWeight: 800, textAlign: "center" }}>
        {subject || "(No subject)"}
      </Text>

      <Text style={{ margin: "0 0 14px", color: "#444", textAlign: "center" }}>
        Route: <strong>{originName}</strong> → <strong>{destName}</strong>
      </Text>

      <Section style={{ textAlign: "center", marginTop: 10 }}>
        <Button href={href} style={BUTTON}>
          View flight status
        </Button>
      </Section>

      <Text style={{ fontSize: 12, color: "#666", marginTop: 18, textAlign: "center" }}>
        We found your link and slapped a stamp on it.
      </Text>
    </EmailLayout>
  );
}

export default function Preview() {
  return (
    <LetterStatusLinkResentEmail
      subject="Your secret letter"
      originName="Seattle, WA"
      destName="Portland, OR"
      statusUrl="/l/demo-token"
    />
  );
}