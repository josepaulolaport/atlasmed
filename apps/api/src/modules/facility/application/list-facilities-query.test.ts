import { describe, expect, it } from "bun:test";
import {
  funnelStageToPurchaseBucket,
  parseListFacilitiesQuery,
  purchaseBucketToFunnelFilter,
} from "./list-facilities-query";

describe("parseListFacilitiesQuery", () => {
  it("requires both coordinates, bounds them, and parses comma-separated product IDs", () => {
    expect(() => parseListFacilitiesQuery({ latitude: "-23.55" })).toThrow();
    expect(() => parseListFacilitiesQuery({ latitude: "91", longitude: "0" })).toThrow();
    expect(parseListFacilitiesQuery({ latitude: "-23.55", longitude: "-46.63", radiusKm: "5", productIds: "1,2" }))
      .toMatchObject({ latitude: -23.55, longitude: -46.63, radiusKm: 5, productIds: [1, 2] });
  });

  it("parses purchase filters and applies context-sensitive sort defaults", () => {
    expect(parseListFacilitiesQuery({ search: "central", purchaseFunnelStage: "CHURN,PURCHASE_WINDOW", purchaseProfile: "AUTOMATIC", purchaseIntervalMinDays: "15", purchaseIntervalMaxDays: "90" }))
      .toMatchObject({
        purchaseFunnelStages: ["CHURN", "PURCHASE_WINDOW"],
        purchaseProfile: "AUTOMATIC",
        purchaseIntervalMinDays: 15,
        purchaseIntervalMaxDays: 90,
        sort: "relevance",
        order: "desc",
      });
    expect(parseListFacilitiesQuery({})).toMatchObject({ sort: "name", order: "asc" });
  });

  it("validates purchase filters, interval bounds, and order", () => {
    expect(() => parseListFacilitiesQuery({ purchaseFunnelStage: "CHURN,INVALID" })).toThrow();
    expect(() => parseListFacilitiesQuery({ purchaseProfile: "INVALID" })).toThrow();
    expect(() => parseListFacilitiesQuery({ purchaseIntervalMinDays: "0" })).toThrow();
    expect(() => parseListFacilitiesQuery({ purchaseIntervalMaxDays: "3651" })).toThrow();
    expect(() => parseListFacilitiesQuery({ purchaseIntervalMinDays: "90", purchaseIntervalMaxDays: "30" })).toThrow();
    expect(() => parseListFacilitiesQuery({ order: "sideways" })).toThrow();
  });

  it("validates relevance/distance sort requirements and accepts explicit business sorts", () => {
    expect(() => parseListFacilitiesQuery({ sort: "relevance" })).toThrow();
    expect(parseListFacilitiesQuery({ search: "central", sort: "relevance" })).toMatchObject({ sort: "relevance" });
    expect(() => parseListFacilitiesQuery({ sort: "distance" })).toThrow();
    expect(parseListFacilitiesQuery({ sort: "distance", latitude: "-23.55", longitude: "-46.63", order: "desc" }))
      .toMatchObject({ sort: "distance", order: "desc", latitude: -23.55, longitude: -46.63 });
    expect(parseListFacilitiesQuery({ sort: "purchaseFunnelStage" })).toMatchObject({ sort: "purchaseFunnelStage", order: "asc" });
    expect(parseListFacilitiesQuery({ sort: "purchaseIntervalDays" })).toMatchObject({ sort: "purchaseIntervalDays", order: "asc" });
    expect(parseListFacilitiesQuery({ sort: "lastPurchaseDate" })).toMatchObject({ sort: "lastPurchaseDate", order: "asc" });
  });

  it("accepts purchaseBucket values used by Desempenho drill-down", () => {
    expect(parseListFacilitiesQuery({ purchaseBucket: "neverBought" })).toMatchObject({
      purchaseBucket: "neverBought",
    });
    expect(parseListFacilitiesQuery({ purchaseBucket: "active" })).toMatchObject({
      purchaseBucket: "active",
    });
    expect(() => parseListFacilitiesQuery({ purchaseBucket: "OTHER" })).toThrow();
  });

  it("groups the funnel stages by how recently the clinic bought", () => {
    // Ativas = bought recently (OUTSIDE_WINDOW) + due to buy now
    // (PURCHASE_WINDOW). Inativas = overdue (CHURN) + lapsed (INACTIVE).
    expect(purchaseBucketToFunnelFilter("active")).toEqual({
      stages: ["OUTSIDE_WINDOW", "PURCHASE_WINDOW"],
      includeNull: false,
    });
    expect(purchaseBucketToFunnelFilter("inactive")).toEqual({
      stages: ["CHURN", "INACTIVE"],
      includeNull: false,
    });
    expect(purchaseBucketToFunnelFilter("neverBought")).toEqual({
      stages: ["NEVER_PURCHASED"],
      includeNull: true,
    });
  });

  it("maps funnel stages back to Desempenho buckets", () => {
    expect(funnelStageToPurchaseBucket("OUTSIDE_WINDOW")).toBe("active");
    expect(funnelStageToPurchaseBucket("PURCHASE_WINDOW")).toBe("active");
    expect(funnelStageToPurchaseBucket("CHURN")).toBe("inactive");
    // A clinic that bought for two years and stopped is not one that never
    // bought — that distinction is the whole point of the INACTIVE stage.
    expect(funnelStageToPurchaseBucket("INACTIVE")).toBe("inactive");
    expect(funnelStageToPurchaseBucket("NEVER_PURCHASED")).toBe("neverBought");
    expect(funnelStageToPurchaseBucket(null)).toBe("neverBought");
  });

  it("round-trips every stage through its bucket", () => {
    const stages = [
      "NEVER_PURCHASED",
      "OUTSIDE_WINDOW",
      "PURCHASE_WINDOW",
      "CHURN",
      "INACTIVE",
    ] as const;

    for (const stage of stages) {
      const bucket = funnelStageToPurchaseBucket(stage);
      expect(purchaseBucketToFunnelFilter(bucket).stages).toContain(stage);
    }
  });
});
