"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import type { TerritoryMapEditorProps, TerritoryMapProvider } from "../types";
import {
  boundaryToDrawFeatures,
  drawFeaturesToBoundary,
  normalizeTerritoryBoundary,
} from "@/lib/territory/geojson";

function MapController({
  value,
  onChange,
  readOnly,
  onValidationError,
}: TerritoryMapEditorProps) {
  const map = useMap();
  const layersRef = useRef<L.Layer[]>([]);

  const clearLayers = () => {
    for (const layer of layersRef.current) {
      map.removeLayer(layer);
    }
    layersRef.current = [];
  };

  const syncAllLayers = () => {
    const features = layersRef.current
      .map((layer) => {
        const withGeo = layer as L.Layer & { toGeoJSON?: () => GeoJSON.Feature };
        return withGeo.toGeoJSON?.();
      })
      .filter((feature): feature is GeoJSON.Feature => Boolean(feature));

    const boundary = drawFeaturesToBoundary(features);
    if (!boundary) {
      onValidationError?.("Draw at least one valid polygon");
      onChange(null);
      return;
    }

    onChange(boundary);
  };

  useEffect(() => {
    if (!map.pm) return;

    map.pm.setGlobalOptions({
      allowSelfIntersection: false,
    });

    if (!readOnly) {
      map.pm.addControls({
        position: "topleft",
        drawPolygon: true,
        drawCircle: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawMarker: false,
        drawText: false,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        removalMode: true,
      });
    }

    const handleCreate = (event: { layer: L.Layer }) => {
      layersRef.current.push(event.layer);
      syncAllLayers();
    };

    const handleEdit = () => {
      syncAllLayers();
    };

    const handleRemove = (event: { layer: L.Layer }) => {
      layersRef.current = layersRef.current.filter((layer) => layer !== event.layer);
      syncAllLayers();
    };

    map.on("pm:create", handleCreate);
    map.on("pm:edit", handleEdit);
    map.on("pm:remove", handleRemove);

    return () => {
      map.off("pm:create", handleCreate);
      map.off("pm:edit", handleEdit);
      map.off("pm:remove", handleRemove);
      clearLayers();
    };
  }, [map, onChange, onValidationError, readOnly]);

  useEffect(() => {
    clearLayers();

    const normalized = normalizeTerritoryBoundary(value);
    if (!normalized) {
      return;
    }

    for (const feature of boundaryToDrawFeatures(normalized)) {
      const layer = L.geoJSON(feature);
      layer.eachLayer((child) => {
        layersRef.current.push(child);
        child.addTo(map);
        if (!readOnly && "pm" in child) {
          (child as L.Layer & { pm: { enable: () => void } }).pm.enable();
        }
      });
    }

    const group = L.featureGroup(layersRef.current);
    const bounds = group.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, value, readOnly]);

  return null;
}

export function LeafletTerritoryEditor(props: TerritoryMapEditorProps) {
  return (
    <div className="h-[400px] overflow-hidden rounded-md border">
      <MapContainer
        center={[-14.235, -51.925]}
        zoom={4}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController {...props} />
      </MapContainer>
      {!props.readOnly ? (
        <p className="mt-2 text-xs text-gray-500">
          Draw multiple polygons to define non-contiguous parts of the same territory.
        </p>
      ) : null}
    </div>
  );
}

export const leafletTerritoryMapProvider: TerritoryMapProvider = {
  Editor: LeafletTerritoryEditor,
};
