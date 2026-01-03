"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
  ImageOverlay,
} from "react-leaflet";
import L from "leaflet";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds?.length) return;
    map.fitBounds(bounds as any, { padding: [30, 30] });
  }, [map, bounds]);

  return null;
}

type TileStyle = "osm" | "carto_light" | "carto_dark";

function tileConfig(style: TileStyle) {
  // Note: Carto tiles are great for “premium clean” without Mapbox complexity.
  // If you want Mapbox/MapTiler later, we can add it here too.
  switch (style) {
    case "carto_light":
      return {
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      };
    case "carto_dark":
      return {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      };
    case "osm":
    default:
      return {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: "&copy; OpenStreetMap contributors",
      };
  }
}

export default function MapView(props: {
  origin: { lat: number; lon: number };
  dest: { lat: number; lon: number };
  progress: number; // 0..1
  tooltipText?: string;

  /** Change base map look */
  tileStyle?: TileStyle;

  /** A PNG/SVG overlay that sits on top of the map UI (branding/texture/frame) */
  uiOverlayUrl?: string;

  /**
   * A geographic overlay (image is anchored to lat/lng bounds and moves with the map)
   * Example: geoOverlayBounds: [[southLat, westLng],[northLat, eastLng]]
   */
  geoOverlayUrl?: string;
  geoOverlayBounds?: [[number, number], [number, number]];
  geoOverlayOpacity?: number;
}) {
  const { origin, dest } = props;

  const [displayProgress, setDisplayProgress] = useState(() =>
    clamp01(props.progress)
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayProgress;
    const to = clamp01(props.progress);

    const durationMs = 400;
    const start = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const t = clamp01((now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayProgress(lerp(from, to, eased));

      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.progress]);

  const current = {
    lat: lerp(origin.lat, dest.lat, displayProgress),
    lon: lerp(origin.lon, dest.lon, displayProgress),
  };

  const inFlight = useMemo(() => clamp01(props.progress) < 1, [props.progress]);

  const pigeonIcon = useMemo(
    () =>
      L.divIcon({
        className: inFlight ? "pigeonMarker pigeonMarkerFloat" : "pigeonMarker",
        html: "🕊️",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    [inFlight]
  );

  const originIcon = useMemo(
    () =>
      L.divIcon({
        className: "routeMarker",
        html: "🏁",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    []
  );

  const destIcon = useMemo(
    () =>
      L.divIcon({
        className: "routeMarker",
        html: "📬",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    []
  );

  const line: [number, number][] = [
    [origin.lat, origin.lon],
    [dest.lat, dest.lon],
  ];

  const tiles = tileConfig(props.tileStyle ?? "carto_light");

  const showGeoOverlay =
    !!props.geoOverlayUrl &&
    !!props.geoOverlayBounds &&
    props.geoOverlayBounds.length === 2;

  return (
    <div className="mapShell">
      <MapContainer
        center={[current.lat, current.lon]}
        zoom={4}
        scrollWheelZoom={false}
        className="map"
      >
        <TileLayer attribution={tiles.attribution} url={tiles.url} />

        <FitBounds bounds={line} />

        {showGeoOverlay ? (
          <ImageOverlay
            url={props.geoOverlayUrl!}
            bounds={props.geoOverlayBounds as any}
            opacity={typeof props.geoOverlayOpacity === "number" ? props.geoOverlayOpacity : 0.35}
            zIndex={300} // above tiles, below markers/tooltip usually
          />
        ) : null}

        <Polyline
          positions={line}
          pathOptions={{
            color: "#121212",
            weight: 3,
            opacity: 0.55,
          }}
        />

        <Marker position={[origin.lat, origin.lon]} icon={originIcon} />
        <Marker position={[dest.lat, dest.lon]} icon={destIcon} />

        <Marker position={[current.lat, current.lon]} icon={pigeonIcon}>
          <Tooltip
            direction="top"
            offset={[0, -10]}
            opacity={1}
            permanent
            interactive={false}
            className={inFlight ? "pigeonTooltip live" : "pigeonTooltip"}
          >
            <span className="pigeonTooltipRow">
              {inFlight && <span className="pigeonLiveDot" />}
              <span className="pigeonTooltipText">
                {props.tooltipText || "Currently over: somewhere over the U.S."}
              </span>
            </span>
          </Tooltip>
        </Marker>
      </MapContainer>

      {/* UI overlay sits on top of everything (branding / texture / frame) */}
      {props.uiOverlayUrl ? (
        <img className="mapUiOverlay" src={props.uiOverlayUrl} alt="" />
      ) : null}
    </div>
  );
}