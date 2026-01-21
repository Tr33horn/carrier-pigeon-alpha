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
  R("mount-rainier", "Mount Rainier", [46.60, -122.10, 47.10, -121.40], "over"),
  R("olympic-peninsula", "Olympic Peninsula", [46.85, -124.80, 48.45, -122.55], "over"),
  R("san-juan-islands", "the San Juan Islands", [48.35, -123.35, 48.85, -122.65], "over"),
  R("mt-hood", "Mount Hood", [45.15, -121.95, 45.55, -121.40], "over"),
  R("hawaiian-islands", "the Hawaiian Islands", [18.50, -161.10, 22.30, -154.60], "over"),

  // --- Puget Sound / I-5 corridor ---
  R("puget-sound", "Puget Sound", [47.0, -123.5, 48.6, -122.0], "over"),
  R("salish-sea", "Salish Sea", [47.391795,-122.434049,47.456369,-122.352338], "over"),
  R("seattle-metro", "Seattle Metro", [47.2, -122.6, 47.9, -121.9], "over"),
  R("sea-tac", "Seattle Tacoma International Airport", [47.42,-122.31,47.46,-122.29], "over"),

  // --- Oregon / Columbia specifics ---
  R("portland-metro", "Portland Metro", [45.40, -122.95, 45.72, -122.35], "over"),
  R("columbia-gorge", "the Columbia River Gorge", [45.35, -122.25, 45.95, -120.75], "along"),
  R("willamette", "the Willamette Valley", [44.6, -123.4, 46.3, -122.3], "over"),
  R("crater-lake", "Crater Lake", [42.70, -122.45, 43.10, -121.90], "over"),
  R("oregon-coast", "the Oregon Coast", [42.00, -124.85, 46.35, -123.65], "along"),
  R("painted-hills", "the Painted Hills", [44.55, -120.45, 44.75, -120.05], "over"),
  R("yosemite-valley", "Yosemite Valley", [37.65, -119.75, 37.80, -119.45], "over"),
  R("sequoia-kings-canyon", "Sequoia and Kings Canyon", [36.25, -119.90, 37.25, -118.20], "over"),
  R("death-valley", "Death Valley", [35.50, -117.70, 37.50, -115.00], "over"),
  R("lake-tahoe", "Lake Tahoe", [38.80, -120.25, 39.35, -119.85], "over"),
  R("pacific-ocean", "the Pacific Ocean", [19.53, -154.07, 48.50, -122.29], "over"),

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
  R("sawtooth-range", "the Sawtooth Range", [43.80, -115.40, 44.70, -114.30], "over"),
  R("hells-canyon", "Hells Canyon", [44.55, -117.85, 46.05, -116.20], "over"),
  R("craters-of-the-moon", "Craters of the Moon", [43.25, -113.90, 43.75, -113.15], "over"),
  R("snake-river-hells-canyon", "Snake River at Hells Canyon", [45.00, -117.70, 46.00, -116.80], "over"),

  // --- Utah specifics ---
  R("salt-lake-metro", "Salt Lake Metro", [40.55, -112.15, 40.95, -111.70], "over"),
  R("wasatch", "the Wasatch Front", [40.20, -112.30, 41.60, -111.30], "along"),

  // --- Rockies (broad) ---
  R("rockies-n", "the Rockies", [39.00, -114.00, 49.00, -104.00], "crossing"),

  // --- Great Basin / Sierra / deserts ---
  R("great-basin", "the Great Basin", [36.00, -120.00, 43.50, -112.00], "over"),
  R("great-basin-np", "Great Basin National Park", [38.80, -114.60, 39.45, -113.70], "over"),
  R("area-51-region", "Area 51 Region", [37.05, -116.45, 37.70, -115.35], "over"),
  R("sierra-nevada", "the Sierra Nevada", [36.00, -121.80, 41.80, -117.80], "crossing"),
  R("mojave", "the Mojave Desert", [34.00, -118.50, 37.20, -114.00], "over"),
  R("sonoran", "the Sonoran Desert", [31.00, -115.50, 34.60, -110.00], "over"),
  R("grand-canyon", "the Grand Canyon", [35.70, -113.25, 36.45, -111.70], "over"),
  R("monument-valley", "Monument Valley", [36.85, -110.35, 37.15, -109.85], "over"),
  R("sedona-red-rock", "Sedona Red Rock", [34.75, -112.05, 35.15, -111.55], "over"),
  R("petrified-forest", "the Petrified Forest", [34.70, -109.95, 35.10, -109.05], "over"),
  R("saguaro-country", "Saguaro Country", [31.95, -111.35, 32.55, -110.45], "over"),
  R("arches", "Arches", [38.55, -109.75, 38.90, -109.30], "over"),
  R("canyonlands", "Canyonlands", [37.90, -110.40, 38.75, -109.40], "over"),
  R("bryce-canyon", "Bryce Canyon", [37.40, -112.40, 37.80, -111.95], "over"),
  R("zion", "Zion", [37.05, -113.25, 37.45, -112.75], "over"),
  R("glen-canyon", "Glen Canyon", [36.70, -112.70, 37.40, -110.40], "over"),

  // -------------------------------------------------
  // Plains / Midwest (add “badge-friendly” specifics)
  // -------------------------------------------------

  // --- Plains specifics ---
  R("front-range", "the Front Range", [39.20, -105.50, 41.40, -104.60], "along"),
  R("denver-metro", "Denver Metro", [39.55, -105.35, 40.15, -104.65], "over"),
  R("rmnp", "Rocky Mountain National Park", [40.15, -105.95, 40.65, -105.35], "over"),
  R("san-juan-mountains", "the San Juan Mountains", [37.10, -108.60, 38.60, -106.20], "over"),
  R("maroon-bells", "Maroon Bells", [39.02, -107.10, 39.25, -106.75], "over"),
  R("mesa-verde", "Mesa Verde", [37.05, -108.80, 37.40, -108.25], "over"),
  R("yellowstone", "Yellowstone", [44.10, -111.20, 45.20, -109.70], "over"),
  R("grand-teton", "Grand Teton", [43.50, -111.15, 44.15, -110.45], "over"),
  R("devils-tower", "Devils Tower", [44.45, -104.85, 44.75, -104.45], "over"),
  R("glacier", "Glacier National Park", [48.20, -114.55, 49.20, -113.10], "over"),
  R("flathead-lake", "Flathead Lake", [47.55, -114.35, 48.25, -113.75], "over"),
  R("little-bighorn", "Little Bighorn", [45.48, -107.75, 45.75, -107.20], "over"),

  R("high-plains", "the High Plains", [35.00, -106.80, 49.00, -96.00], "over"),
  R("great-plains", "the Great Plains", [33.50, -104.00, 49.50, -94.00], "over"),
  R("badlands", "the Badlands", [43.35, -102.90, 44.20, -101.60], "over"),
  R("black-hills", "the Black Hills", [43.15, -104.35, 44.70, -103.20], "over"),
  R("mount-rushmore", "Mount Rushmore", [43.75, -103.70, 44.05, -103.30], "over"),

  // --- Kansas City / STL corridor (common cross-country route) ---
  R("kansas-city-metro", "Kansas City Metro", [38.80, -95.10, 39.30, -94.30], "over"),
  R("stlouis-metro", "St. Louis Metro", [38.45, -90.65, 38.95, -90.05], "over"),
  R("gateway-arch", "the Gateway Arch", [38.60, -90.25, 38.67, -90.15], "over"),
  R("ozarks", "the Ozarks", [35.50, -94.80, 37.50, -91.50], "over"),

  // --- Mississippi River (badge-friendly) ---
  // loose north-south slab that catches lots of “crossings”
  R("mississippi", "the Mississippi River", [29.00, -91.60, 47.50, -89.20], "crossing"),

  // --- Upper Midwest specifics ---
  R("chicago-metro", "Chicago Metro", [41.55, -88.40, 42.20, -87.30], "over"),
  R("chicago-lakefront", "the Chicago Lakefront", [41.60, -87.75, 42.10, -87.45], "along"),
  R("twin-cities-metro", "the Twin Cities", [44.75, -93.55, 45.25, -92.80], "over"),
  R("boundary-waters", "the Boundary Waters", [47.70, -92.60, 48.40, -90.30], "over"),
  R("lake-superior", "Lake Superior", [46.30, -92.30, 48.50, -84.20], "over"),
  R("mississippi-headwaters", "the Mississippi Headwaters", [47.00, -95.50, 47.40, -94.90], "over"),

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
  R("white-sands", "White Sands", [32.60, -106.65, 33.10, -105.80], "over"),
  R("carlsbad-caverns", "Carlsbad Caverns", [31.95, -104.80, 32.50, -104.10], "over"),
  R("taos-sangre-de-cristo", "Taos Sangre de Cristo", [36.00, -105.95, 36.85, -105.10], "over"),
  R("big-bend", "Big Bend", [28.75, -104.05, 29.85, -102.70], "over"),
  R("guadalupe-mountains", "Guadalupe Mountains", [31.60, -105.05, 32.30, -104.35], "over"),
  R("padre-island", "Padre Island", [26.75, -97.75, 28.70, -96.90], "along"),

  // --- Appalachians / Blue Ridge specifics ---
  R("blue-ridge-parkway", "the Blue Ridge Parkway", [35.20, -83.60, 37.60, -79.00], "along"),
  R("appalachians", "the Appalachians", [35.00, -85.50, 44.00, -75.00], "crossing"),
  R("blue-ridge", "the Blue Ridge", [34.50, -84.50, 39.20, -77.00], "crossing"),
  R("piedmont", "the Piedmont", [33.00, -85.50, 39.50, -77.20], "over"),
  R("smoky-mountains", "the Smoky Mountains", [35.30, -84.30, 35.90, -83.20], "over"),
  R("nashville-basin", "the Nashville Basin", [35.60, -87.30, 36.60, -85.70], "over"),
  R("shenandoah", "Shenandoah", [38.20, -78.80, 38.80, -78.20], "over"),
  R("new-river-gorge", "the New River Gorge", [37.70, -81.20, 38.10, -80.80], "over"),

  // --- Mid-Atlantic specifics ---
  R("dc-metro", "DC Metro", [38.75, -77.35, 39.10, -76.80], "over"),
  R("chesapeake-bay", "the Chesapeake Bay", [36.85, -76.60, 39.75, -75.85], "along"),
  R("mid-atlantic", "the Mid-Atlantic", [37.00, -79.50, 42.80, -72.00], "over"),

  // --- Northeast specifics ---
  R("nyc-metro", "NYC Metro", [40.40, -74.35, 41.10, -73.40], "over"),
  R("philadelphia-metro", "Philadelphia Metro", [39.70, -75.55, 40.20, -74.80], "over"),
  R("boston-metro", "Boston Metro", [42.20, -71.35, 42.55, -70.85], "over"),
  R("adirondacks", "the Adirondacks", [43.80, -75.50, 45.20, -73.30], "over"),
  R("niagara-falls", "Niagara Falls", [43.02, -79.15, 43.15, -78.95], "over"),
  R("hudson-valley", "the Hudson Valley", [41.20, -74.60, 42.80, -73.20], "over"),
  R("acadia", "Acadia", [44.20, -68.50, 44.45, -68.10], "over"),
  R("maine-north-woods", "the Maine North Woods", [45.00, -70.80, 47.20, -67.50], "over"),

  // --- Broad Northeast / New England ---
  R("new-england", "New England", [41.00, -73.80, 47.50, -66.80], "over"),
  R("northeast", "the Northeast", [40.50, -79.50, 47.50, -66.50], "over"),

  // --- Florida specifics ---
  R("miami-metro", "Miami Metro", [25.55, -80.50, 26.25, -80.00], "over"),
  R("orlando-metro", "Orlando Metro", [28.30, -81.65, 28.75, -81.10], "over"),
  R("south-florida", "South Florida", [24.30, -82.00, 26.60, -79.20], "over"),
  R("florida-peninsula", "the Florida Peninsula", [26.00, -83.50, 30.80, -79.30], "over"),
  R("everglades", "the Everglades", [25.10, -81.80, 25.90, -80.30], "over"),
  R("florida-keys", "the Florida Keys", [24.40, -82.20, 25.90, -80.00], "along"),
  R("space-coast", "the Space Coast", [28.30, -80.90, 28.90, -80.40], "over"),
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
