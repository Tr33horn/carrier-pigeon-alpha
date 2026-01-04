import { geoRegionForPoint } from "./usRegions";

function capFirstWordOnly(s: string) {
  // Keeps "the Cascades" as "the Cascades"
  // But makes "yakima Valley" -> "Yakima Valley"
  const trimmed = (s || "").trim();
  if (!trimmed) return trimmed;

  // normalize leading "the" to lowercase "the " while preserving rest
  if (/^the\s+/i.test(trimmed)) return trimmed.replace(/^the\s+/i, "the ");

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function stripLeadingPrefix(label: string) {
  // If labels ever come in like "Over X" or "Crossing Y", strip it so we don't double up.
  return label.replace(/^(over|crossing|along|approaching)\s+/i, "").trim();
}

function cleanLabel(label: string) {
  // One place to clean: trim, strip "Over", then capitalization rules
  return capFirstWordOnly(stripLeadingPrefix(label));
}

/**
 * Returns a “real-ish” phrase from coords.
 * Later you can swap in reverse-geocode and keep this same interface.
 */
export function checkpointGeoText(lat: number, lon: number): string {
  const region = geoRegionForPoint(lat, lon);
  if (!region) return "somewhere over the U.S.";

  const base = cleanLabel(region.label);

  // Small grammar sugar so it reads like a flight update.
  switch (region.kind) {
    case "crossing":
      return `Crossing ${base}`;
    case "along":
      return `Along ${base}`;
    case "approaching":
      return `Approaching ${base}`;
    case "over":
    default:
      return `Over ${base}`;
  }
}