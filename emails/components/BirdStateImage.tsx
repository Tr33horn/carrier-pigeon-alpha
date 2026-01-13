import { Img, Section } from "@react-email/components";
import { APP_URL } from "@/app/lib/email/config";

export type BirdType = "pigeon" | "snipe" | "goose";
export type BirdState = "fly" | "sleep" | "landed";

function joinUrl(base: string, pathOrUrl: string) {
  if (!pathOrUrl) return base;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
}

function birdPrefix(bird: BirdType) {
  if (bird === "goose") return "canada-goose";
  if (bird === "snipe") return "great-snipe";
  return "homing-pigeon";
}

function birdFilename(bird: BirdType, state: BirdState) {
  return `${birdPrefix(bird)}-${state}.png`;
}

export function BirdStateImage({
  bird = "pigeon",
  state = "fly",
  alt,
}: {
  bird?: BirdType | null;
  state?: BirdState;
  alt?: string;
}) {
  const safeBird: BirdType = bird === "goose" || bird === "snipe" ? bird : "pigeon";
  const src = joinUrl(APP_URL, `/birds/${birdFilename(safeBird, state)}`);

  return (
    <Section style={{ margin: "10px 0 18px", textAlign: "center" }}>
      <Img
        src={src}
        width="220"
        height="220"
        alt={alt || `${safeBird} ${state}`}
        style={{
          margin: "0 auto",
          display: "block",
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.06)",
          backgroundColor: "#fbfaf7",
        }}
      />
    </Section>
  );
}