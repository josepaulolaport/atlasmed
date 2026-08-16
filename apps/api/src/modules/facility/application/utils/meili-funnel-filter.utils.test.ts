import { describe, expect, it } from "bun:test";
import { meiliFunnelStageFilter, meiliPurchaseProfileFilter } from "./meili-funnel-filter.utils";

/**
 * These have to mean the same thing as the SQL in `drizzle-facility.repository`,
 * which builds an EXISTS over active profiles: "a profile matches", never "all
 * of them do". The unscoped AUTOMATIC filter used to be
 * `verticalManualPurchaseProfiles IS EMPTY` — all profiles automatic — so a
 * clinic running one line automatically and another on a manual profile dropped
 * out of a list it belongs in, invisibly: the hydrate guard only reacts to Meili
 * returning too many rows.
 */
describe("meiliPurchaseProfileFilter", () => {
  it("unscoped AUTOMATIC matches a clinic with any automatic profile", () => {
    expect(meiliPurchaseProfileFilter(undefined, "AUTOMATIC")).toEqual({
      expression: "purchaseIntervalSourcesAny IN ['CALCULATED', 'DEFAULT']",
    });
  });

  it("unscoped preset matches a clinic with any profile on that preset", () => {
    expect(meiliPurchaseProfileFilter([], "QUARTERLY")).toEqual({
      expression: "manualPurchaseProfilesAny IN ['QUARTERLY']",
    });
  });

  it("stays per-vertical when the scope names one", () => {
    expect(meiliPurchaseProfileFilter([10], "AUTOMATIC")).toEqual({
      expression: "verticalPurchaseIntervalSources IN ['10:CALCULATED', '10:DEFAULT']",
    });
    expect(meiliPurchaseProfileFilter([10], "QUARTERLY")).toEqual({
      expression: "verticalManualPurchaseProfiles IN ['10:QUARTERLY']",
    });
  });
});

describe("meiliFunnelStageFilter", () => {
  it("returns nothing without stages", () => {
    expect(meiliFunnelStageFilter([10], [])).toBeUndefined();
  });

  it("scopes to the vertical when exactly one is in scope", () => {
    expect(meiliFunnelStageFilter([10], ["CHURN", "INACTIVE"])).toEqual({
      expression: "verticalFunnelStages IN ['10:CHURN', '10:INACTIVE']",
    });
  });

  it("falls back to the unscoped any-stage field across verticals", () => {
    expect(meiliFunnelStageFilter([10, 11], ["CHURN"])).toEqual({
      expression: "purchaseFunnelStagesAny IN ['CHURN']",
    });
  });
});
