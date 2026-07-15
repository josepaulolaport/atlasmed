import { describe, expect, it } from "bun:test";
import { parseListFacilitiesQuery } from "./list-facilities-query";

describe("parseListFacilitiesQuery", () => {
  it("requires both coordinates, bounds them, and parses comma-separated product IDs", () => {
    expect(() => parseListFacilitiesQuery({ latitude: "-23.55" })).toThrow();
    expect(() => parseListFacilitiesQuery({ latitude: "91", longitude: "0" })).toThrow();
    expect(parseListFacilitiesQuery({ latitude: "-23.55", longitude: "-46.63", radiusKm: "5", productIds: "one,two" }))
      .toMatchObject({ latitude: -23.55, longitude: -46.63, radiusKm: 5, productIds: ["one", "two"] });
  });
});
