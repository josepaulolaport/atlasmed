import { describe, expect, it } from "bun:test";
import { normalizeTerritoryBoundary } from "./territory-boundary.utils";
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
