import { describe, expect, it } from "bun:test";
import {
  assertSinglePolygonForEditableTerritory,
  normalizeTerritoryBoundary,
} from "./territory-boundary.utils";
import { OperationNotAllowedError } from "../../../../shared/errors";

describe("normalizeTerritoryBoundary", () => {
  const polygon = {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  };

  it("returns polygon geometry unchanged", () => {
    expect(normalizeTerritoryBoundary(polygon)).toEqual(polygon);
  });

  it("collapses single-part MultiPolygon to Polygon", () => {
    const multi = {
      type: "MultiPolygon" as const,
      coordinates: [polygon.coordinates],
    };

    const result = normalizeTerritoryBoundary(multi);
    expect(result.type).toBe("Polygon");
    expect(result.coordinates).toEqual(polygon.coordinates);
  });

  it("keeps true MultiPolygon when multiple parts exist", () => {
    const multi = {
      type: "MultiPolygon" as const,
      coordinates: [
        polygon.coordinates,
        [
          [
            [2, 2],
            [3, 2],
            [3, 3],
            [2, 2],
          ],
        ],
      ],
    };

    const result = normalizeTerritoryBoundary(multi);
    expect(result.type).toBe("MultiPolygon");
    expect(result.coordinates).toHaveLength(2);
  });

  it("rejects empty polygon coordinates", () => {
    expect(() =>
      normalizeTerritoryBoundary({ type: "Polygon", coordinates: [] })
    ).toThrow(OperationNotAllowedError);
  });
});

describe("assertSinglePolygonForEditableTerritory", () => {
  const singlePolygon = {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  };

  const multiPolygon = {
    type: "MultiPolygon" as const,
    coordinates: [
      singlePolygon.coordinates,
      [
        [
          [2, 2],
          [3, 2],
          [3, 3],
          [2, 2],
        ],
      ],
    ],
  };

  const repPatchType = { slug: "patch", assignsClinics: true };
  const managerZoneType = { slug: "manager_zone", assignsClinics: false };
  const otherType = { slug: "other", assignsClinics: false };

  it("rejects a MultiPolygon for a rep patch", () => {
    expect(() =>
      assertSinglePolygonForEditableTerritory(repPatchType, multiPolygon, "save_boundary")
    ).toThrow(OperationNotAllowedError);
  });

  it("rejects a MultiPolygon for a manager zone", () => {
    expect(() =>
      assertSinglePolygonForEditableTerritory(managerZoneType, multiPolygon, "save_boundary")
    ).toThrow(OperationNotAllowedError);
  });

  it("allows a single Polygon for a rep patch", () => {
    expect(() =>
      assertSinglePolygonForEditableTerritory(repPatchType, singlePolygon, "save_boundary")
    ).not.toThrow();
  });

  it("allows a MultiPolygon for other territory types", () => {
    expect(() =>
      assertSinglePolygonForEditableTerritory(otherType, multiPolygon, "save_boundary")
    ).not.toThrow();
  });
});
