"use client";

import { type CSSProperties } from "react";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("../MapView"), {
  ssr: false,
});

export type MapStyle = "carto-positron" | "carto-voyager" | "carto-positron-nolabels" | "ink-sketch";
export type MarkerMode = "flying" | "sleeping" | "delivered" | "canceled";

type LatLon = { lat: number; lon: number };

// ✅ Toggle: keep picker code, but hide it for now
const SHOW_MAP_STYLE_PICKER = false;

export default function MapSection(props: {
  mapStyle: MapStyle;
  setMapStyle: (s: MapStyle) => void;

  origin: LatLon;
  dest: LatLon;

  progress: number; // 0..1
  progressPctFloor: number; // 0..100 (already floored upstream)

  tooltipText: string;
  markerMode: MarkerMode;

  // live-only for dev overlay inputs
  showLive: boolean;
  sentAtISO?: string;
  etaAtISO?: string;

  currentlyOver: string;

  milestones: { pct: number; label: string; isPast: boolean }[];

  showProgressPills?: boolean;
  cardClassName?: string;
  cardStyle?: CSSProperties;
}) {
  const {
    mapStyle,
    setMapStyle,
    origin,
    dest,
    progress,
    progressPctFloor,
    tooltipText,
    markerMode,
    showLive,
    sentAtISO,
    etaAtISO,
    currentlyOver,
    milestones,
    showProgressPills = true,
    cardClassName,
    cardStyle,
  } = props;

  return (
    <div className={`card mapCard ${cardClassName || ""}`.trim()} style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div className="kicker">Map</div>

        {SHOW_MAP_STYLE_PICKER ? (
          <div className="mapStyleRow" role="group" aria-label="Map style">
            <button
              type="button"
              className={`mapStyleBtn ${mapStyle === "carto-positron" ? "on" : ""}`}
              onClick={() => setMapStyle("carto-positron")}
              aria-pressed={mapStyle === "carto-positron"}
            >
              Light
            </button>

            <button
              type="button"
              className={`mapStyleBtn ${mapStyle === "carto-voyager" ? "on" : ""}`}
              onClick={() => setMapStyle("carto-voyager")}
              aria-pressed={mapStyle === "carto-voyager"}
            >
              Voyager
            </button>

            <button
              type="button"
              className={`mapStyleBtn ${mapStyle === "carto-positron-nolabels" ? "on" : ""}`}
              onClick={() => setMapStyle("carto-positron-nolabels")}
              aria-pressed={mapStyle === "carto-positron-nolabels"}
            >
              No Labels
            </button>

            <button
              type="button"
              className={`mapStyleBtn ${mapStyle === "ink-sketch" ? "on" : ""}`}
              onClick={() => setMapStyle("ink-sketch")}
              aria-pressed={mapStyle === "ink-sketch"}
            >
              Ink
            </button>
          </div>
        ) : null}
      </div>

      <div className="mapWrap" style={{ marginTop: 12 }}>
        <MapView
          origin={origin}
          dest={dest}
          progress={progress}
          tooltipText={tooltipText}
          mapStyle={mapStyle}
          markerMode={markerMode}
          // ✅ Dev-only sleep overlay inputs only when live (prevents weird overlays in terminal states)
          sentAtISO={showLive ? sentAtISO : undefined}
          etaAtISO={showLive ? etaAtISO : undefined}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="bar">
          <div className="barFill" style={{ width: `${progressPctFloor}%` }} />
          {[25, 50, 75].map((p) => (
            <span key={p} className="barTick" style={{ left: `${p}%` }} />
          ))}
        </div>

        <div className="barMeta">
          <div className="mutedStrong">{progressPctFloor}%</div>
          <div className="muted">{`Current: ${currentlyOver}`}</div>
        </div>

        {showProgressPills ? (
          <div className="chips">
            {milestones.map((m) => (
              <div key={m.pct} className={`chip ${m.isPast ? "on" : ""}`}>
                <span className="chipDot">{m.isPast ? "●" : "○"}</span>
                <span className="chipLabel">{m.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
