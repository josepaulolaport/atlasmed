import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";

type PolygonCoordinates = number[][][];
type MultiPolygonCoordinates = number[][][][];

export function normalizeTerritoryBoundary(geoJson: GeoJsonGeometry): GeoJsonGeometry {
  if (geoJson.type === "Polygon") {
    const coordinates = geoJson.coordinates as PolygonCoordinates;
    if (coordinates.length === 0) {
      throw new OperationNotAllowedError("save_boundary", "Polygon coordinates cannot be empty");
    }
    return { type: "Polygon", coordinates };
  }

  const polygons = (geoJson.coordinates as MultiPolygonCoordinates).filter(
    (polygon) => polygon.length > 0
  );
  if (polygons.length === 0) {
    throw new OperationNotAllowedError("save_boundary", "MultiPolygon coordinates cannot be empty");
  }
  if (polygons.length === 1) {
    return { type: "Polygon", coordinates: polygons[0]! };
  }
  return { type: "MultiPolygon", coordinates: polygons };
}
