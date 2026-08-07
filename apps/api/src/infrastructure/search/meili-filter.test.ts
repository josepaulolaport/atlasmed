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
      inFilter("activeFacilityIds", [2, 1, 1]),
      geoRadiusFilter(-23.55, -46.63, 2500),
    ])).toBe("activeFacilityIds IN [1, 2] AND _geoRadius(-23.55, -46.63, 2500)");
  });

  it("builds allowlisted purchase filters with composite tokens and numeric bounds", () => {
    expect(buildMeiliFilter([
      inFilter("verticalFunnelStages", ["2:PURCHASE_WINDOW", "2:CHURN"]),
      inFilter("verticalPurchaseIntervalSources", ["2:MANUAL"]),
      inFilter("verticalManualPurchaseProfiles", ["2:MONTHLY"]),
      inFilter("purchaseFunnelStagesAny", ["PURCHASE_WINDOW", "CHURN"]),
      gteFilter("purchaseIntervalDaysMin", 15),
      lteFilter("purchaseIntervalDaysMin", 90),
    ])).toBe("verticalFunnelStages IN ['2:CHURN', '2:PURCHASE_WINDOW'] AND verticalPurchaseIntervalSources IN ['2:MANUAL'] AND verticalManualPurchaseProfiles IN ['2:MONTHLY'] AND purchaseFunnelStagesAny IN ['CHURN', 'PURCHASE_WINDOW'] AND purchaseIntervalDaysMin >= 15 AND purchaseIntervalDaysMin <= 90");
  });

  it("returns undefined when the bounded expression would be too large", () => {
    expect(buildMeiliFilter([inFilter("id", ["one", "two"])], 10)).toBeUndefined();
  });

  it("supports verticalIds array filter field", () => {
    expect(buildMeiliFilter([inFilter("verticalIds", [2, 1])])).toBe(
      "verticalIds IN [1, 2]"
    );
  });
});
