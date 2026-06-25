import { describe, expect, it } from "bun:test";
import {
  assertBoundaryProvidedForType,
} from "./territory-boundary.application";
import { OperationNotAllowedError } from "../../../../shared/errors";

describe("assertBoundaryProvidedForType", () => {
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

  it("requires a boundary when the type supports boundaries", () => {
    expect(() => assertBoundaryProvidedForType(true, undefined)).toThrow(
      OperationNotAllowedError
    );
    expect(assertBoundaryProvidedForType(true, polygon)).toEqual(polygon);
  });

  it("rejects a boundary when the type does not support boundaries", () => {
    expect(() => assertBoundaryProvidedForType(false, polygon)).toThrow(
      OperationNotAllowedError
    );
  });

  it("normalizes multi-part boundaries to MultiPolygon", () => {
    const multi = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
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

    const result = assertBoundaryProvidedForType(true, multi);
    expect(result.type).toBe("MultiPolygon");
    expect(result.coordinates).toHaveLength(2);
  });
});
