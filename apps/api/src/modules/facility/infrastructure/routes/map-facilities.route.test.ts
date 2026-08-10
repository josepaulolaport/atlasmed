import { describe, expect, it } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { mapFacilitiesQuerySchema } from "./map-facilities.route";

describe("map facilities query schema", () => {
  it("accepts the legacy query without viewport bounds", () => {
    expect(Value.Check(mapFacilitiesQuerySchema, {})).toBe(true);
  });

  it("accepts a complete viewport", () => {
    expect(
      Value.Check(mapFacilitiesQuerySchema, {
        verticalId: 7,
        south: -23.7,
        west: -46.8,
        north: -23.4,
        east: -46.5,
      }),
    ).toBe(true);
  });

  it("rejects partial viewport bounds", () => {
    expect(
      Value.Check(mapFacilitiesQuerySchema, {
        south: -23.7,
        west: -46.8,
      }),
    ).toBe(false);
  });
});
