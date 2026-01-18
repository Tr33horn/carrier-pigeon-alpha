export type GeoRegion = {
  id: string;
  label: string;
  // bbox: [minLat, minLon, maxLat, maxLon]
  bbox: [number, number, number, number];
  // optional “vibe” for phrase generation
  kind?: "over" | "crossing" | "along" | "approaching";
};

const R = (
  id: string,
  label: string,
  bbox: GeoRegion["bbox"],
  kind: GeoRegion["kind"] = "over"
): GeoRegion => ({
  id,
  label,
  bbox,
  kind,
});

/**
 * Lightweight regions you can extend forever.
 *
 * NOTE: Regions overlap on purpose. Matching uses "most specific wins"
 * (smallest bbox area), so you can add detailed regions without worrying
 * about ordering.
 *
 * Tips:
 * - If you want a badge like "Crossed the Rockies", use region ids in badge logic:
 *   rockies-n (or add rockies-s, etc.)
 * - For very specific city-ish regions, keep bbox SMALL so they win.
 */
export const US_REGIONS: GeoRegion[] = [
  // -------------------------------------------------
  // Pacific Northwest / West (specific first, broad later)
  // -------------------------------------------------

  // --- Seattle-area specifics (tiny bboxes, win often) ---
  R("downtown-seattle", "Downtown Seattle", [47.58, -122.36, 47.63, -122.31], "over"),
  R("lake-washington", "Lake Washington", [47.53, -122.31, 47.76, -122.16], "along"),
  R("snoqualmie-pass", "Snoqualmie Pass", [47.37, -121.50, 47.48, -121.33], "crossing"),
  R("issaquah-alps", "the Issaquah Alps", [47.47, -122.06, 47.61, -121.85], "over"),
  R("squak-mountain", "Squak Mountain", [47.48, -122.059, 47.51, -122.028], "over"),

  // --- Puget Sound / I-5 corridor ---
  R("puget-sound", "Puget Sound", [47.0, -123.5, 48.6, -122.0], "over"),
  R("salish-sea", "Salish Sea", [47.391795,-122.434049,47.456369,-122.352338], "over"),
  R("seattle-metro", "Seattle Metro", [47.2, -122.6, 47.9, -121.9], "over"),
  R("sea-tac", "Seattle Tacoma International Airport", [47.42,-122.31,47.46,-122.29], "over"),
  // --- Oregon / Columbia specifics ---
  R("portland-metro", "Portland Metro", [45.40, -122.95, 45.72, -122.35], "over"),
  R("columbia-gorge", "the Columbia River Gorge", [45.35, -122.25, 45.95, -120.75], "along"),
  R("willamette", "the Willamette Valley", [44.6, -123.4, 46.3, -122.3], "over"),

  // --- WA interior specifics ---
  R("yakima", "the Yakima Valley", [46.20, -121.00, 47.20, -119.50], "over"),
  R("tri-cities", "the Tri-Cities", [45.95, -119.45, 46.45, -118.70], "over"),
  R("spokane-metro", "Spokane Metro", [47.53, -117.65, 47.78, -117.20], "over"),

  // --- Cascades (broad) ---
  // keep label without extra "the" duplication later; geoText handles grammar
  R("cascades-n", "the Cascades", [45.50, -122.20, 49.10, -119.30], "crossing"),

  // --- Idaho / Snake specifics ---
  R("id-panhandle", "the Idaho Panhandle", [47.00, -117.40, 49.10, -115.30], "over"),
  R("boise-metro", "Boise Metro", [43.45, -116.35, 43.75, -116.05], "over"),
  R("snake-river", "the Snake River Plain", [42.50, -116.90, 44.80, -111.00], "over"),

  // --- Utah specifics ---
  R("salt-lake-metro", "Salt Lake Metro", [40.55, -112.15, 40.95, -111.70], "over"),
  R("wasatch", "the Wasatch Front", [40.20, -112.30, 41.60, -111.30], "along"),

  // --- Rockies (broad) ---
  R("rockies-n", "the Rockies", [39.00, -114.00, 49.00, -104.00], "crossing"),

  // --- Great Basin / Sierra / deserts ---
  R("great-basin", "the Great Basin", [36.00, -120.00, 43.50, -112.00], "over"),
  R("sierra-nevada", "the Sierra Nevada", [36.00, -121.80, 41.80, -117.80], "crossing"),
  R("mojave", "the Mojave Desert", [34.00, -118.50, 37.20, -114.00], "over"),
  R("sonoran", "the Sonoran Desert", [31.00, -115.50, 34.60, -110.00], "over"),

  // -------------------------------------------------
  // Plains / Midwest (add “badge-friendly” specifics)
  // -------------------------------------------------

  // --- Plains specifics ---
  R("front-range", "the Front Range", [39.20, -105.50, 41.40, -104.60], "along"),
  R("denver-metro", "Denver Metro", [39.55, -105.35, 40.15, -104.65], "over"),

  R("high-plains", "the High Plains", [35.00, -106.80, 49.00, -96.00], "over"),
  R("great-plains", "the Great Plains", [33.50, -104.00, 49.50, -94.00], "over"),

  // --- Kansas City / STL corridor (common cross-country route) ---
  R("kansas-city-metro", "Kansas City Metro", [38.80, -95.10, 39.30, -94.30], "over"),
  R("stlouis-metro", "St. Louis Metro", [38.45, -90.65, 38.95, -90.05], "over"),

  // --- Mississippi River (badge-friendly) ---
  // loose north-south slab that catches lots of “crossings”
  R("mississippi", "the Mississippi River", [29.00, -91.60, 47.50, -89.20], "crossing"),

  // --- Upper Midwest specifics ---
  R("chicago-metro", "Chicago Metro", [41.55, -88.40, 42.20, -87.30], "over"),
  R("twin-cities-metro", "the Twin Cities", [44.75, -93.55, 45.25, -92.80], "over"),

  // --- Broad Midwest / Great Lakes ---
  R("great-lakes", "the Great Lakes", [41.00, -92.00, 49.50, -75.00], "over"),
  R("midwest", "the Midwest", [38.00, -95.50, 49.50, -80.50], "over"),

  // -------------------------------------------------
  // South / East (more specifics + corridor hits)
  // -------------------------------------------------

  // --- Texas/Gulf specifics ---
  R("texas-hill", "the Texas Hill Country", [29.00, -100.80, 31.60, -97.00], "over"),
  R("gulf-coast", "the Gulf Coast", [25.80, -98.00, 30.60, -80.00], "along"),
  R("houston-metro", "Houston Metro", [29.45, -95.90, 30.20, -94.90], "over"),
  R("dallas-metro", "Dallas–Fort Worth", [32.55, -97.75, 33.35, -96.45], "over"),

  // --- Appalachians / Blue Ridge specifics ---
  R("blue-ridge-parkway", "the Blue Ridge Parkway", [35.20, -83.60, 37.60, -79.00], "along"),
  R("appalachians", "the Appalachians", [35.00, -85.50, 44.00, -75.00], "crossing"),
  R("blue-ridge", "the Blue Ridge", [34.50, -84.50, 39.20, -77.00], "crossing"),
  R("piedmont", "the Piedmont", [33.00, -85.50, 39.50, -77.20], "over"),

  // --- Mid-Atlantic specifics ---
  R("dc-metro", "DC Metro", [38.75, -77.35, 39.10, -76.80], "over"),
  R("chesapeake-bay", "the Chesapeake Bay", [36.85, -76.60, 39.75, -75.85], "along"),
  R("mid-atlantic", "the Mid-Atlantic", [37.00, -79.50, 42.80, -72.00], "over"),

  // --- Northeast specifics ---
  R("nyc-metro", "NYC Metro", [40.40, -74.35, 41.10, -73.40], "over"),
  R("philadelphia-metro", "Philadelphia Metro", [39.70, -75.55, 40.20, -74.80], "over"),
  R("boston-metro", "Boston Metro", [42.20, -71.35, 42.55, -70.85], "over"),

  // --- Broad Northeast / New England ---
  R("new-england", "New England", [41.00, -73.80, 47.50, -66.80], "over"),
  R("northeast", "the Northeast", [40.50, -79.50, 47.50, -66.50], "over"),

  // --- Florida specifics ---
  R("miami-metro", "Miami Metro", [25.55, -80.50, 26.25, -80.00], "over"),
  R("orlando-metro", "Orlando Metro", [28.30, -81.65, 28.75, -81.10], "over"),
  R("south-florida", "South Florida", [24.30, -82.00, 26.60, -79.20], "over"),
  R("florida-peninsula", "the Florida Peninsula", [26.00, -83.50, 30.80, -79.30], "over"),
];

/** bbox area heuristic: smaller = more specific */
function bboxArea([minLat, minLon, maxLat, maxLon]: GeoRegion["bbox"]) {
  return Math.abs((maxLat - minLat) * (maxLon - minLon));
}

/**
 * “Most specific wins” region matcher.
 * If multiple regions contain the point, returns the one with the smallest bbox.
 */
export function matchUSRegion(lat: number, lon: number): GeoRegion | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const matches: GeoRegion[] = [];

  for (const r of US_REGIONS) {
    const [minLat, minLon, maxLat, maxLon] = r.bbox;
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      matches.push(r);
    }
  }

  if (!matches.length) return null;

  // smallest bbox = most specific
  matches.sort((a, b) => bboxArea(a.bbox) - bboxArea(b.bbox));
  return matches[0];
}

// ✅ Alias expected by the rest of the app
export function geoRegionForPoint(lat: number, lon: number): GeoRegion | null {
  return matchUSRegion(lat, lon);
}