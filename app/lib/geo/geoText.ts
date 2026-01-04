import { matchUSRegion } from "./usRegions";

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Returns a “real-ish” phrase from coords.
 * Keep it simple now; later you can swap to reverse geocode and still return the same interface.
 */
export function checkpointGeoText(lat: number, lon: number): string {
  const region = matchUSRegion(lat, lon);

  if (!region) return "somewhere over the U.S.";

  // Small grammar sugar so it reads like a flight update.
  switch (region.kind) {
    case "crossing":
      // label already includes "the ..." in most cases
      return `Crossing ${region.label}`;
    case "along":
      return `Along ${region.label}`;
    case "approaching":
      return `Approaching ${region.label}`;
    case "over":
    default:
      // if label starts with "the", keep it. Otherwise "Over Yakima Valley" is fine.
      return `Over ${cap(region.label)}`;
  }
}