import * as React from "react";
import { Img, Section } from "@react-email/components";
import { APP_URL } from "@/app/lib/email/config";

export type BirdType = "pigeon" | "snipe" | "goose";
export type BirdState = "flying" | "sleeping" | "landed";

function birdBaseName(bird: BirdType) {
  switch (bird) {
    case "goose":
      return "canada-goose";
    case "snipe":
      return "great-snipe";
    default:
      return "homing-pigeon";
  }
}

function birdImageUrl(bird: BirdType, state: BirdState) {
  return `${APP_URL}/birds/${birdBaseName(bird)}-${state}.png`;
}

export function BirdStateImage({
  bird = "pigeon",
  state = "flying",
  alt,
}: {
  bird?: BirdType | null;
  state?: BirdState;
  alt?: string;
}) {
  const safeBird: BirdType =
    bird === "goose" || bird === "snipe" || bird === "pigeon" ? bird : "pigeon";

  const src = birdImageUrl(safeBird, state);

  return (
    <Section style={{ margin: "10px 0 14px" }}>
      <Img
        src={src}
        alt={alt || `${safeBird} ${state}`}
        width="520"
        height="auto"
        style={{
          display: "block",
          width: "100%",
          maxWidth: 520,
          borderRadius: 14,
          border: "1px solid #eee",
          backgroundColor: "#fafafa",
        }}
      />
    </Section>
  );
}