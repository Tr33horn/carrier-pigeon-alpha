// app/lib/geo/badges.ts
import { geoRegionForPoint, type GeoRegion } from "./usRegions";

export type BadgeDef = {
  code: string;           // unique key: "crossed-rockies"
  title: string;          // "Crossed the Rockies"
  description?: string;   // optional
  icon?: string;          // optional (emoji or later: icon key)
  meta?: Record<string, any>;
};

/** Linear interpolate */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Sample N points on the route and gather region IDs touched.
 * This is intentionally "game-y" not survey-grade accurate.
 */
export function regionsTouchedOnRoute(
  oLat: number,
  oLon: number,
  dLat: number,
  dLon: number,
  samples = 24
): GeoRegion[] {
  const hit = new Map<string, GeoRegion>();

  const n = Math.max(6, Math.min(80, samples));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const lat = lerp(oLat, dLat, t);
    const lon = lerp(oLon, dLon, t);

    const r = geoRegionForPoint(lat, lon);
    if (r && !hit.has(r.id)) hit.set(r.id, r);
  }

  return Array.from(hit.values());
}

/**
 * Turn regions -> badges.
 * You can expand this list forever without schema changes.
 */
export function badgesForRoute(
  oLat: number,
  oLon: number,
  dLat: number,
  dLon: number
): BadgeDef[] {
  const regions = regionsTouchedOnRoute(oLat, oLon, dLat, dLon, 28);
  const ids = new Set(regions.map((r) => r.id));

  const out: BadgeDef[] = [];

  // ---- Region badges (specific wins) ----
  const add = (code: string, title: string, description?: string, meta?: Record<string, any>) => {
    out.push({ code, title, description, icon: "🏷️", meta });
  };

  if (ids.has("cascades-n")) add("crossed-cascades", "Crossed the Cascades");
  if (ids.has("rockies-n")) add("crossed-rockies", "Crossed the Rockies");
  if (ids.has("appalachians")) add("crossed-appalachians", "Crossed the Appalachians");
  if (ids.has("blue-ridge")) add("crossed-blue-ridge", "Crossed the Blue Ridge");

  if (ids.has("snake-river")) add("snake-river-plain", "Over the Snake River Plain");
  if (ids.has("yakima")) add("yakima-valley", "Over Yakima Valley");
  if (ids.has("columbia-gorge")) add("columbia-river-gorge", "Along the Columbia River Gorge");
  if (ids.has("great-lakes")) add("great-lakes", "Over the Great Lakes");
  if (ids.has("gulf-coast")) add("gulf-coast", "Along the Gulf Coast");
  if (ids.has("texas-hill")) add("texas-hill-country", "Over the Texas Hill Country");
  if (ids.has("mojave")) add("mojave", "Over the Mojave Desert");
  if (ids.has("sierra-nevada")) add("sierra-nevada", "Crossed the Sierra Nevada");

  // ---- “Special rule” badge: Coast-to-coast-ish ----
  // Super simple heuristic: origin near Pacific-ish and destination near Atlantic-ish.
  // (You can tighten later.)
  const isWest = oLon <= -118;
  const isEast = dLon >= -80;
  if (isWest && isEast) add("coast-to-coast", "Coast to Coast", "That bird deserves a tiny medal.");

  return out;
}