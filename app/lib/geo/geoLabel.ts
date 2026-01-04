// lib/geo/geoLabel.ts
export type GeoKind =
  | "coast"
  | "range"
  | "plain"
  | "plateau"
  | "desert"
  | "metro"
  | "generic";

export type GeoRegion = {
  id: string;
  name: string;
  kind: GeoKind;
  priority: number;
  bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number };
};

function inBbox(lat: number, lon: number, b: GeoRegion["bbox"]) {
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

export function verbFor(kind: GeoKind) {
  switch (kind) {
    case "range":
      return "Crossing";
    case "coast":
      return "Along";
    case "metro":
      return "Over";
    default:
      return "Over";
  }
}

/**
 * Returns a "real-ish" label for a coordinate based on regions.
 * Example: { text: "Crossing the Cascades", regionId: "cascades_washington" }
 */
export function geoLabelFor(lat: number, lon: number, regions: GeoRegion[]) {
  let best: GeoRegion | null = null;

  for (const r of regions) {
    if (!inBbox(lat, lon, r.bbox)) continue;
    if (!best || r.priority > best.priority) best = r;
  }

  if (!best) return null;

  const v = verbFor(best.kind);
  // If your region name already includes "the", this still reads fine.
  return {
    text: `${v} ${best.name}`,
    regionId: best.id,
    kind: best.kind,
  };
}