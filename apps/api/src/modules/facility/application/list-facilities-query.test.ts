import { describe, expect, it } from "bun:test";
import { parseListFacilitiesQuery } from "./list-facilities-query";

describe("parseListFacilitiesQuery", () => {
  it("requires both coordinates, bounds them, and parses comma-separated product IDs", () => {
    expect(() => parseListFacilitiesQuery({ latitude: "-23.55" })).toThrow();
    expect(() => parseListFacilitiesQuery({ latitude: "91", longitude: "0" })).toThrow();
    expect(parseListFacilitiesQuery({ latitude: "-23.55", longitude: "-46.63", radiusKm: "5", productIds: "one,two" }))
      .toMatchObject({ latitude: -23.55, longitude: -46.63, radiusKm: 5, productIds: ["one", "two"] });
  });

  it("validates relevance/distance sort and requires coordinates for distance", () => {
    expect(parseListFacilitiesQuery({ sort: "relevance" })).toMatchObject({ sort: "relevance" });
    expect(() => parseListFacilitiesQuery({ sort: "distance" })).toThrow();
    expect(parseListFacilitiesQuery({ sort: "distance", latitude: "-23.55", longitude: "-46.63" }))
      .toMatchObject({ sort: "distance", latitude: -23.55, longitude: -46.63 });
    expect(() => parseListFacilitiesQuery({ sort: "name" })).toThrow();
  });
});
