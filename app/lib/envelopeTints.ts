export type EnvelopeTint = "classic" | "fog" | "sky" | "sage" | "blush" | "sand" | "midnight";

export const ENVELOPE_TINTS: { id: EnvelopeTint; label: string; color: string }[] = [
  { id: "classic", label: "Classic", color: "#fff7ea" },
  { id: "fog", label: "Fog", color: "#f1f3f5" },
  { id: "sky", label: "Sky", color: "#e8f2ff" },
  { id: "sage", label: "Sage", color: "#e9f4ee" },
  { id: "blush", label: "Blush", color: "#fdecef" },
  { id: "sand", label: "Sand", color: "#f6efe2" },

  // Slightly more "midnight" without killing readability
  { id: "midnight", label: "Midnight", color: "#e3e7f2" },
];

const ENVELOPE_TINT_SET: ReadonlySet<EnvelopeTint> = new Set(ENVELOPE_TINTS.map((t) => t.id));

export function normalizeEnvelopeTint(input: unknown): EnvelopeTint {
  if (typeof input !== "string") return "classic";
  const key = input as EnvelopeTint;
  return ENVELOPE_TINT_SET.has(key) ? key : "classic";
}

export function getEnvelopeTintColor(tint: EnvelopeTint): string {
  return ENVELOPE_TINTS.find((t) => t.id === tint)?.color ?? ENVELOPE_TINTS[0]!.color;
}

/**
 * Optional helper for UI: use as
 *   <div style={getEnvelopeTintStyle(tint)} />
 * and reference var(--env-tint) in CSS.
 */
export function getEnvelopeTintStyle(tint: EnvelopeTint) {
  return { ["--env-tint" as any]: getEnvelopeTintColor(tint) } as React.CSSProperties;
}