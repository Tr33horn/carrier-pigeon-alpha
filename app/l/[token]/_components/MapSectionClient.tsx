"use client";

import { useState } from "react";

import MapSection, { type MapStyle, type MarkerMode } from "./MapSection";

type LatLon = { lat: number; lon: number };

export default function MapSectionClient(props: {
  origin: LatLon;
  dest: LatLon;
  progress: number;
  progressPctFloor: number;
  tooltipText: string;
  markerMode: MarkerMode;
  showLive: boolean;
  sentAtISO?: string;
  etaAtISO?: string;
  currentlyOver: string;
  cardClassName?: string;
  wrapCard?: boolean;
}) {
  const [mapStyle, setMapStyle] = useState<MapStyle>("carto-positron");

  return (
    <MapSection
      mapStyle={mapStyle}
      setMapStyle={setMapStyle}
      origin={props.origin}
      dest={props.dest}
      progress={props.progress}
      progressPctFloor={props.progressPctFloor}
      tooltipText={props.tooltipText}
      markerMode={props.markerMode}
      showLive={props.showLive}
      sentAtISO={props.sentAtISO}
      etaAtISO={props.etaAtISO}
      currentlyOver={props.currentlyOver}
      cardClassName={props.cardClassName}
      wrapCard={props.wrapCard}
    />
  );
}
