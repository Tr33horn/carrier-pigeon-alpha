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

function niceMilestoneLabel(m: 25 | 50 | 75) {
  if (m === 25) return "Update: 25%";
  if (m === 50) return "Update: 50%";
  return "Update: 75%";
}

function cleanOverText(s?: string | null) {
  const raw = (s || "").trim();
  if (!raw) return "";
  // If backend already sends “Over ___” we won’t double-prefix it.
  if (/^over\s+/i.test(raw)) {
    const cleaned = raw.replace(/^over\s+/i, "");
    return /^somewhere over the u\.s\.$/i.test(cleaned) ? "Somewhere over the U.S." : `Over ${cleaned}`;
  }
  return /^somewhere over the u\.s\.$/i.test(raw) ? "Somewhere over the U.S." : `Over ${raw}`;
}

export function LetterProgressUpdateEmail({
  milestone,
  pct,
  fromName,
  statusUrl,
  etaTextUtc,
  funLine,
  bird,

  // ✅ prefer the new prop name used by the cron route…
  overText,

  // ✅ …but keep backwards compatibility with your earlier draft
  locationText,
}: {
  milestone: 25 | 50 | 75;
  pct: number;
  fromName?: string | null;
  statusUrl: string; // path or absolute
  etaTextUtc: string;
  funLine: string;
  bird?: BirdType | null;

  /** ✅ NEW preferred: “Over Seattle Metro”, etc */
  overText?: string | null;

  /** ✅ Back-compat */
  locationText?: string | null;
}) {
  const href = statusUrl.startsWith("http") ? statusUrl : joinUrl(APP_URL, statusUrl);

  const overLine = cleanOverText(overText || locationText);

  // ✅ Location-first preview (this is what most inboxes show)
  const preview = overLine
    ? `${overLine}.`
    : milestone === 25
    ? "25% of the way there."
    : milestone === 50
    ? "Halfway there."
    : "75% complete (incoming).";

  const title = overLine ? `${niceMilestoneLabel(milestone)} · ${overLine}` : niceMilestoneLabel(milestone);

  return (
    <EmailLayout preview={preview}>
      <BirdStateImage bird={bird ?? undefined} state="fly" alt="Courier in flight" />

      <Text style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px", textAlign: "center" }}>
        {title}
      </Text>

      <Text style={{ margin: "0 0 10px", textAlign: "center" }}>
        Your sealed letter from <strong>{fromName || "someone"}</strong> is still in flight.
      </Text>

      {overLine ? (
        <Text style={{ margin: "0 0 14px", color: "#444", textAlign: "center" }}>
          Current location: <strong>{overLine}</strong>
        </Text>
      ) : null}

      <Text style={{ margin: "0 0 14px", color: "#444", textAlign: "center" }}>
        ETA (UTC): <strong>{etaTextUtc}</strong>
      </Text>

      <Text style={{ margin: "0 0 14px", color: "#444", textAlign: "center" }}>
        <em>{funLine}</em>
      </Text>

      <Section style={{ textAlign: "center", marginTop: 10 }}>
        <Button href={href} style={BUTTON}>
          Check flight status ({Math.round(pct)}%)
        </Button>
      </Section>

      <Text style={{ fontSize: 12, color: "#666", marginTop: 18, textAlign: "center" }}>
        Still sealed. Still mysterious.
      </Text>
    </EmailLayout>
  );
}

export default function Preview() {
  return (
    <LetterProgressUpdateEmail
      milestone={50}
      pct={50}
      fromName="Greggor"
      statusUrl="/l/demo-token"
      etaTextUtc="2026-01-08 02:30 UTC"
      funLine="The bird stopped briefly for a dramatic skyline moment."
      bird="goose"
      overText="Over Seattle Metro"
    />
  );
}
