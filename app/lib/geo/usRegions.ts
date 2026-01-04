export type GeoRegion = {
  id: string;
  label: string;
  // bbox: [minLat, minLon, maxLat, maxLon]
  bbox: [number, number, number, number];
  // optional “vibe” for phrase generation
  kind?: "over" | "crossing" | "along" | "approaching";
};

const R = (id: string, label: string, bbox: GeoRegion["bbox"], kind: GeoRegion["kind"] = "over"): GeoRegion => ({
  id,
  label,
  bbox,
  kind,
});

/**
 * Lightweight, US-wide regions you can extend forever.
 * BBoxes are intentionally “loose” so it feels plausible, not legal-survey accurate.
 */
export const US_REGIONS: GeoRegion[] = [
  // --- Pacific Northwest / West ---
  R("puget-sound", "Puget Sound", [47.0, -123.5, 48.6, -122.0], "over"),
  R("seattle-metro", "Seattle Metro", [47.2, -122.6, 47.9, -121.9], "over"),
  R("willamette", "Willamette Valley", [44.6, -123.4, 46.3, -122.3], "over"),
  R("columbia-gorge", "Columbia River Gorge", [45.4, -122.2, 45.9, -120.8], "along"),
  R("yakima", "Yakima Valley", [46.2, -121.0, 47.2, -119.5], "over"),
  R("cascades-n", "the Cascades", [45.5, -122.2, 49.1, -119.3], "crossing"),

  R("id-panhandle", "the Idaho Panhandle", [47.0, -117.4, 49.1, -115.3], "over"),
  R("snake-river", "the Snake River Plain", [42.5, -116.9, 44.8, -111.0], "over"),
  R("wasatch", "the Wasatch Front", [40.2, -112.3, 41.6, -111.3], "along"),

  R("rockies-n", "the Rockies", [39.0, -114.0, 49.0, -104.0], "crossing"),

  R("great-basin", "the Great Basin", [36.0, -120.0, 43.5, -112.0], "over"),
  R("sierra-nevada", "the Sierra Nevada", [36.0, -121.8, 41.8, -117.8], "crossing"),
  R("mojave", "the Mojave Desert", [34.0, -118.5, 37.2, -114.0], "over"),
  R("sonoran", "the Sonoran Desert", [31.0, -115.5, 34.6, -110.0], "over"),

  // --- Plains / Midwest ---
  R("high-plains", "the High Plains", [35.0, -106.8, 49.0, -96.0], "over"),
  R("great-plains", "the Great Plains", [33.5, -104.0, 49.5, -94.0], "over"),
  R("midwest", "the Midwest", [38.0, -95.5, 49.5, -80.5], "over"),
  R("great-lakes", "the Great Lakes", [41.0, -92.0, 49.5, -75.0], "over"),

  // --- South / East ---
  R("texas-hill", "the Texas Hill Country", [29.0, -100.8, 31.6, -97.0], "over"),
  R("gulf-coast", "the Gulf Coast", [25.8, -98.0, 30.6, -80.0], "along"),

  R("appalachians", "the Appalachians", [35.0, -85.5, 44.0, -75.0], "crossing"),
  R("blue-ridge", "the Blue Ridge", [34.5, -84.5, 39.2, -77.0], "crossing"),
  R("piedmont", "the Piedmont", [33.0, -85.5, 39.5, -77.2], "over"),

  R("mid-atlantic", "the Mid-Atlantic", [37.0, -79.5, 42.8, -72.0], "over"),
  R("northeast", "the Northeast", [40.5, -79.5, 47.5, -66.5], "over"),
  R("new-england", "New England", [41.0, -73.8, 47.5, -66.8], "over"),

  // Florida detail
  R("south-florida", "South Florida", [24.3, -82.0, 26.6, -79.2], "over"),
  R("florida-peninsula", "the Florida Peninsula", [26.0, -83.5, 30.8, -79.3], "over"),
];

export function matchUSRegion(lat: number, lon: number): GeoRegion | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  for (const r of US_REGIONS) {
    const [minLat, minLon, maxLat, maxLon] = r.bbox;
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) return r;
  }
  return null;
}