import type { GeoJsonGeometry } from "../interfaces/territory-spatial.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";
import {
  isManagerZoneType,
  isRepPatchType,
} from "../constants/territory-roles.constants";

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

/**
 * Rep patches and manager zones are manually drawn/edited (mobile territory
 * editor) and must always be a single connected polygon — disconnected areas
 * are rejected rather than persisted as a MultiPolygon. Any other territory
 * type is exempt: real-world shapes there can legitimately be multi-part.
 */
export function assertSinglePolygonForEditableTerritory(
  type: { slug: string },
  boundary: GeoJsonGeometry,
  operation: string
): void {
  if (boundary.type !== "MultiPolygon") {
    return;
  }
  if (!isRepPatchType(type) && !isManagerZoneType(type)) {
    return;
  }
  throw new OperationNotAllowedError(
    operation,
    "This territory type must be a single connected polygon; merge or remove disconnected areas before saving"
  );
}
