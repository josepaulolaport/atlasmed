"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { TerritoryMapEditorProps, TerritoryMapProvider } from "../types";
import type { GeoJsonPolygon } from "@/types/territory";
import { getCachedMapsConfig } from "@/lib/maps/config";
import {
  boundaryToDrawFeatures,
  boundaryToPolygonCoordinates,
  drawFeaturesToBoundary,
  normalizeTerritoryBoundary,
} from "@/lib/territory/geojson";

function MapboxTerritoryEditorInner({
  value,
  onChange,
  readOnly,
  onValidationError,
}: TerritoryMapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const onChangeRef = useRef(onChange);
  const onValidationErrorRef = useRef(onValidationError);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    onValidationErrorRef.current = onValidationError;
  }, [onChange, onValidationError]);

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      if (!containerRef.current) {
        return;
      }

      const config = await getCachedMapsConfig();
      const token = config.publicToken;

      if (!token) {
        setError("Mapbox public token is not configured. Set MAPBOX_PUBLIC_TOKEN on the API.");
        return;
      }

      if (disposed) {
        return;
      }

      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-46.6333, -23.5505],
        zoom: 4,
      });

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: readOnly
          ? {}
          : {
            polygon: true,
            trash: true,
          },
        defaultMode: readOnly ? "simple_select" : "draw_polygon",
      });

      map.addControl(draw);
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      const sync = () => {
        const collection = draw.getAll();
        const geometry = drawFeaturesToBoundary(collection.features);
        if (!geometry) {
          onValidationErrorRef.current?.("Draw at least one valid polygon");
          onChangeRef.current(null);
          return;
        }
        onChangeRef.current(geometry);
      };

      map.on("draw.create", sync);
      map.on("draw.update", sync);
      map.on("draw.delete", sync);

      mapRef.current = map;
      drawRef.current = draw;
      setError(null);
      setReady(true);
    }

    initMap().catch(() => {
      onValidationErrorRef.current?.("Failed to initialize Mapbox editor");
      setError("Failed to initialize Mapbox editor");
    });

    return () => {
      disposed = true;
      setReady(false);
      drawRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [readOnly]);

  useEffect(() => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!ready || !draw || !map) {
      return;
    }

    draw.deleteAll();

    const normalized = normalizeTerritoryBoundary(value);
    if (!normalized) {
      return;
    }

    for (const feature of boundaryToDrawFeatures(normalized)) {
      draw.add(feature);
    }

    const polygons = boundaryToPolygonCoordinates(normalized);
    const firstRing = polygons[0]?.[0];
    if (firstRing?.length) {
      const bounds = polygons
        .flatMap((polygon) => polygon[0] ?? [])
        .reduce(
          (acc, [lng, lat]) => acc.extend([lng, lat]),
          new mapboxgl.LngLatBounds(
            firstRing[0] as [number, number],
            firstRing[0] as [number, number]
          )
        );
      map.fitBounds(bounds, { padding: 40, maxZoom: 12 });
    }
  }, [ready, value]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div>
      <div ref={containerRef} className="h-[420px] w-full rounded-md border" />
      {!readOnly ? (
        <p className="mt-2 text-xs text-gray-500">
          Draw multiple polygons to define non-contiguous parts of the same territory.
        </p>
      ) : null}
    </div>
  );
}

export const mapboxTerritoryMapProvider: TerritoryMapProvider = {
  Editor: MapboxTerritoryEditorInner,
};
