// geoRegions.routes.ts
export type GeoKind = "coast" | "range" | "plain" | "plateau" | "desert" | "metro" | "generic";

export type GeoRegion = {
  id: string;
  name: string;          // used in copy: "Over {name}" / "Crossing {name}"
  kind: GeoKind;
  priority: number;      // higher wins
  bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number };
};

// NOTE: BBoxes are intentionally "route-friendly" not academically perfect.
// Goal: make labels feel right for typical flight lines.

export const ROUTE_TUNED_REGIONS: GeoRegion[] = [
  /* -------------------------
     PACIFIC NORTHWEST (Seattle / Portland starts)
  ------------------------- */
  { id: "puget_sound", name: "Puget Sound", kind: "coast", priority: 96,
    bbox: { minLat: 47.0, minLon: -123.5, maxLat: 48.9, maxLon: -122.0 } },

  { id: "salish_sea", name: "Salish Sea", kind: "coast", priority: 98,
    bbox: { minLat: 47.42, minLon: -122.41, maxLat: 47.44, maxLon: -122.39 } },

  { id: "willamette_valley", name: "the Willamette Valley", kind: "plain", priority: 92,
    bbox: { minLat: 44.7, minLon: -123.5, maxLat: 46.3, maxLon: -122.3 } },

  { id: "snoqualmie_pass", name: "Snoqualmie Pass", kind: "range", priority: 98,
    bbox: { minLat: 47.2, minLon: -121.95, maxLat: 47.65, maxLon: -121.15 } },

  { id: "cascades_washington", name: "the Cascades", kind: "range", priority: 90,
    bbox: { minLat: 46.5, minLon: -122.2, maxLat: 49.1, maxLon: -120.3 } },

  { id: "yakima_valley", name: "the Yakima Valley", kind: "plain", priority: 91,
    bbox: { minLat: 46.1, minLon: -121.0, maxLat: 47.3, maxLon: -119.6 } },

  { id: "palouse", name: "the Palouse", kind: "plain", priority: 89,
    bbox: { minLat: 46.0, minLon: -119.2, maxLat: 47.6, maxLon: -116.6 } },

  /* -------------------------
     INTERMOUNTAIN WEST (Idaho / Utah / Nevada lanes)
  ------------------------- */
  { id: "snake_river_plain", name: "the Snake River Plain", kind: "plain", priority: 88,
    bbox: { minLat: 42.5, minLon: -116.7, maxLat: 44.9, maxLon: -111.1 } },

  { id: "great_basin", name: "the Great Basin", kind: "desert", priority: 82,
    bbox: { minLat: 36.5, minLon: -120.5, maxLat: 43.8, maxLon: -112.0 } },

  { id: "utah_high_plateaus", name: "Utah’s high plateaus", kind: "plateau", priority: 80,
    bbox: { minLat: 37.0, minLon: -113.8, maxLat: 41.3, maxLon: -110.5 } },

  /* -------------------------
     ROCKIES (Denver routes)
  ------------------------- */
  { id: "rocky_mountains_north", name: "the Rocky Mountains", kind: "range", priority: 90,
    bbox: { minLat: 40.0, minLon: -115.0, maxLat: 49.3, maxLon: -104.0 } },

  { id: "front_range", name: "the Front Range", kind: "range", priority: 96,
    bbox: { minLat: 38.3, minLon: -105.9, maxLat: 41.7, maxLon: -104.5 } },

  { id: "denver_metro", name: "Denver metro", kind: "metro", priority: 97,
    bbox: { minLat: 39.35, minLon: -105.25, maxLat: 40.25, maxLon: -104.45 } },

  { id: "high_plains", name: "the High Plains", kind: "plain", priority: 83,
    bbox: { minLat: 34.5, minLon: -105.0, maxLat: 43.0, maxLon: -96.5 } },

  /* -------------------------
     SOUTHWEST / TEXAS (Portland→Austin, LA→NY variants)
  ------------------------- */
  { id: "four_corners", name: "the Four Corners", kind: "plateau", priority: 84,
    bbox: { minLat: 35.0, minLon: -112.5, maxLat: 38.0, maxLon: -107.0 } },

  { id: "new_mexico_high_desert", name: "New Mexico’s high desert", kind: "desert", priority: 81,
    bbox: { minLat: 32.5, minLon: -109.2, maxLat: 37.2, maxLon: -103.0 } },

  { id: "west_texas", name: "West Texas", kind: "plain", priority: 82,
    bbox: { minLat: 29.0, minLon: -106.7, maxLat: 35.2, maxLon: -100.6 } },

  { id: "texas_hill_country", name: "the Texas Hill Country", kind: "plateau", priority: 90,
    bbox: { minLat: 29.0, minLon: -100.8, maxLat: 31.8, maxLon: -97.1 } },

  { id: "austin_metro", name: "Austin metro", kind: "metro", priority: 97,
    bbox: { minLat: 30.0, minLon: -98.25, maxLat: 30.6, maxLon: -97.4 } },

  /* -------------------------
     GULF / SOUTHEAST (Seattle→Miami lane)
  ------------------------- */
  { id: "gulf_coastal_plain", name: "the Gulf Coast", kind: "coast", priority: 86,
    bbox: { minLat: 25.0, minLon: -98.8, maxLat: 31.7, maxLon: -80.8 } },

  { id: "florida_peninsula", name: "the Florida peninsula", kind: "coast", priority: 88,
    bbox: { minLat: 24.4, minLon: -82.9, maxLat: 30.9, maxLon: -79.7 } },

  { id: "miami_metro", name: "Miami metro", kind: "metro", priority: 97,
    bbox: { minLat: 25.35, minLon: -80.7, maxLat: 26.4, maxLon: -80.05 } },

  /* -------------------------
     APPALACHIANS / CAROLINAS (Seattle→Asheville, LA→NY often touches)
  ------------------------- */
  { id: "appalachian_ridge", name: "the Appalachian Ridge", kind: "range", priority: 88,
    bbox: { minLat: 35.0, minLon: -84.9, maxLat: 44.9, maxLon: -73.7 } },

  { id: "blue_ridge", name: "the Blue Ridge", kind: "range", priority: 92,
    bbox: { minLat: 34.7, minLon: -83.7, maxLat: 39.0, maxLon: -77.0 } },

  { id: "asheville_metro", name: "Asheville area", kind: "metro", priority: 97,
    bbox: { minLat: 35.35, minLon: -82.85, maxLat: 35.75, maxLon: -82.3 } },

  /* -------------------------
     NORTHEAST (LA→NY destination)
  ------------------------- */
  { id: "northeast_corridor", name: "the Northeast Corridor", kind: "generic", priority: 80,
    bbox: { minLat: 38.7, minLon: -77.8, maxLat: 43.2, maxLon: -70.0 } },

  { id: "new_york_metro", name: "New York metro", kind: "metro", priority: 97,
    bbox: { minLat: 40.25, minLon: -74.5, maxLat: 41.2, maxLon: -73.35 } },

  /* -------------------------
     SOUTHERN CALIFORNIA (LA origin)
  ------------------------- */
  { id: "la_basin", name: "the Los Angeles Basin", kind: "coast", priority: 97,
    bbox: { minLat: 33.3, minLon: -118.95, maxLat: 34.5, maxLon: -117.2 } },

  { id: "mojave", name: "the Mojave Desert", kind: "desert", priority: 86,
    bbox: { minLat: 34.4, minLon: -118.7, maxLat: 37.3, maxLon: -114.5 } },
];