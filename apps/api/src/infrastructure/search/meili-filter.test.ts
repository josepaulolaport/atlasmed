import { describe, expect, it } from "bun:test";
import {
  buildMeiliFilter,
  eqFilter,
  geoRadiusFilter,
  gteFilter,
  inFilter,
  isNullFilter,
  lteFilter,
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

  it("builds allowlisted purchase filters with numeric bounds and null checks", () => {
    expect(buildMeiliFilter([
      inFilter("purchaseFunnelStage", ["PURCHASE_WINDOW", "CHURN"]),
      eqFilter("purchaseIntervalSource", "MANUAL"),
      isNullFilter("manualPurchaseProfile"),
      gteFilter("purchaseIntervalDays", 15),
      lteFilter("purchaseIntervalDays", 90),
    ])).toBe("purchaseFunnelStage IN ['CHURN', 'PURCHASE_WINDOW'] AND purchaseIntervalSource = 'MANUAL' AND manualPurchaseProfile IS NULL AND purchaseIntervalDays >= 15 AND purchaseIntervalDays <= 90");
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
