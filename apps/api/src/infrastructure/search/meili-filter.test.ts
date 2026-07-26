import { describe, expect, it } from "bun:test";
import {
  buildMeiliFilter,
  eqFilter,
  geoRadiusFilter,
  inFilter,
} from "./meili-filter";

describe("Meilisearch filter builder", () => {
  it("escapes quoted and backslash string values", () => {
    expect(buildMeiliFilter([eqFilter("specialtyNormalized", "d'água \\ vascular")]))
      .toBe("specialtyNormalized = 'd\\'água \\\\ vascular'");
  });

  it("builds typed IN and geo-radius clauses without interpolating field names", () => {
    expect(buildMeiliFilter([
      inFilter("activeFacilityIds", ["facility-2", "facility-1", "facility-1"]),
      geoRadiusFilter(-23.55, -46.63, 2500),
    ])).toBe("activeFacilityIds IN ['facility-1', 'facility-2'] AND _geoRadius(-23.55, -46.63, 2500)");
  });

  it("returns undefined when the bounded expression would be too large", () => {
    expect(buildMeiliFilter([inFilter("id", ["one", "two"])], 10)).toBeUndefined();
  });

  it("supports verticalIds array filter field", () => {
    expect(buildMeiliFilter([inFilter("verticalIds", ["v2", "v1"])])).toBe(
      "verticalIds IN ['v1', 'v2']"
    );
  });
});
