import type { GeoJsonPolygon } from "@/types/territory";

type PolygonCoordinates = GeoJSON.Polygon["coordinates"];
type MultiPolygonCoordinates = GeoJSON.MultiPolygon["coordinates"];

export function parseGeoJsonPolygon(text: string): GeoJsonPolygon | null {
  try {
    const parsed = JSON.parse(text) as GeoJsonPolygon;
    return normalizeTerritoryBoundary(parsed);
  } catch {
    return null;
  }
}

export function isValidGeoJsonPolygon(
  value: GeoJsonPolygon | null | undefined
): value is GeoJsonPolygon {
  return normalizeTerritoryBoundary(value) !== null;
}

/** Split a territory boundary into individual polygon coordinate sets. */
export function boundaryToPolygonCoordinates(
  boundary: GeoJsonPolygon
): PolygonCoordinates[] {
  if (boundary.type === "Polygon") {
    return [boundary.coordinates as PolygonCoordinates];
  }

  return (boundary.coordinates as MultiPolygonCoordinates).filter(
    (polygon) => polygon.length > 0
  );
}

/** Merge one or more polygons into a Polygon or MultiPolygon boundary. */
export function combinePolygonCoordinates(
  polygons: PolygonCoordinates[]
): GeoJsonPolygon | null {
  const normalized = polygons.filter((polygon) => polygon.length > 0);
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length === 1) {
    return {
      type: "Polygon",
      coordinates: normalized[0],
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: normalized,
  };
}

/** Normalize incoming geometry to a valid single- or multi-polygon boundary. */
export function normalizeTerritoryBoundary(
  value: GeoJsonPolygon | null | undefined
): GeoJsonPolygon | null {
  if (!value) {
    return null;
  }

  if (value.type === "Polygon") {
    const coordinates = value.coordinates as PolygonCoordinates;
    return coordinates.length > 0 ? { type: "Polygon", coordinates } : null;
  }

  if (value.type === "MultiPolygon") {
    const polygons = boundaryToPolygonCoordinates(value);
    return combinePolygonCoordinates(polygons);
  }

  return null;
}

export function polygonCount(boundary: GeoJsonPolygon): number {
  return boundaryToPolygonCoordinates(boundary).length;
}

export function boundaryToDrawFeatures(boundary: GeoJsonPolygon): GeoJSON.Feature[] {
  return boundaryToPolygonCoordinates(boundary).map((coordinates) => ({
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates,
    },
  }));
}

export function drawFeaturesToBoundary(
  features: GeoJSON.Feature[]
): GeoJsonPolygon | null {
  const polygons = features
    .map((feature) => feature.geometry)
    .filter((geometry): geometry is GeoJSON.Polygon => geometry?.type === "Polygon")
    .map((geometry) => geometry.coordinates);

  return combinePolygonCoordinates(polygons);
}
