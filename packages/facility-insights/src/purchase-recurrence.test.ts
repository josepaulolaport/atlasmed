import { describe, expect, test } from "bun:test";

import {
  PURCHASE_PROFILE_INTERVAL_DAYS,
  PurchaseRecurrenceValidationError,
  calculatePurchaseRecurrenceSnapshot,
} from "./index";

const TODAY = "2026-07-22";

function calculate(
  overrides: Partial<Parameters<typeof calculatePurchaseRecurrenceSnapshot>[0]> = {},
) {
  return calculatePurchaseRecurrenceSnapshot({
    purchaseDates: [],
    manualProfile: null,
    manualIntervalDays: null,
    today: TODAY,
    ...overrides,
  });
}

describe("calculatePurchaseRecurrenceSnapshot", () => {
  test("uses the default interval and NEVER_PURCHASED when there are no purchases", () => {
    expect(calculate()).toEqual({
      observedPurchaseIntervalDays: null,
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "DEFAULT",
      purchaseProfile: null,
      manualPurchaseIntervalDays: null,
      lastValidPurchaseDate: null,
      purchaseRecurrenceSampleSize: 0,
      purchaseFunnelStage: "NEVER_PURCHASED",
      nextPurchaseFunnelTransitionDate: null,
    });
  });

  test("uses the default interval and the purchase age when there is one purchase", () => {
    expect(calculate({ purchaseDates: ["2026-07-01T23:59:59-03:00"] })).toMatchObject({
      observedPurchaseIntervalDays: null,
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "DEFAULT",
      lastValidPurchaseDate: "2026-07-02",
      purchaseRecurrenceSampleSize: 0,
      purchaseFunnelStage: "PURCHASE_WINDOW",
      nextPurchaseFunnelTransitionDate: "2026-08-31",
    });
  });

  test("rounds the mean of up to twelve consecutive intervals", () => {
    expect(
      calculate({ purchaseDates: ["2026-07-20", "2026-07-10", "2026-06-29"] }),
    ).toMatchObject({
      observedPurchaseIntervalDays: 11,
      purchaseIntervalDays: 11,
      purchaseIntervalSource: "CALCULATED",
      lastValidPurchaseDate: "2026-07-20",
      purchaseRecurrenceSampleSize: 2,
    });
  });

  test("supports all sample sizes from one through twelve intervals", () => {
    for (let intervalCount = 1; intervalCount <= 12; intervalCount += 1) {
      const purchaseDates = Array.from({ length: intervalCount + 1 }, (_, index) =>
        new Date(Date.UTC(2026, 6, 20 - index * 7)).toISOString(),
      );

      expect(calculate({ purchaseDates })).toMatchObject({
        observedPurchaseIntervalDays: 7,
        purchaseIntervalDays: 7,
        purchaseIntervalSource: "CALCULATED",
        purchaseRecurrenceSampleSize: intervalCount,
      });
    }
  });

  test("uses only the thirteen most recent distinct purchase dates", () => {
    const purchaseDates = [
      ...Array.from({ length: 13 }, (_, index) =>
        new Date(Date.UTC(2026, 6, 20 - index * 2)).toISOString(),
      ),
      "2020-01-01",
    ];

    expect(calculate({ purchaseDates })).toMatchObject({
      observedPurchaseIntervalDays: 2,
      purchaseIntervalDays: 2,
      purchaseRecurrenceSampleSize: 12,
      lastValidPurchaseDate: "2026-07-20",
    });
  });

  test("normalizes and deduplicates purchases on the same UTC civil day", () => {
    expect(
      calculate({
        purchaseDates: [
          "2026-07-20T00:30:00Z",
          "2026-07-19T21:30:00-03:00",
          "2026-07-10T12:00:00Z",
        ],
      }),
    ).toMatchObject({
      observedPurchaseIntervalDays: 10,
      lastValidPurchaseDate: "2026-07-20",
      purchaseRecurrenceSampleSize: 1,
    });
  });

  test("defines the supported preset profile intervals", () => {
    expect(PURCHASE_PROFILE_INTERVAL_DAYS).toEqual({
      WEEKLY: 7,
      BIWEEKLY: 15,
      MONTHLY: 30,
      BIMONTHLY: 60,
      QUARTERLY: 90,
      SEMIANNUAL: 180,
      ANNUAL: 365,
    });
  });

  test("applies a preset manual profile without discarding the observed interval", () => {
    expect(
      calculate({
        purchaseDates: ["2026-07-20", "2026-07-10"],
        manualProfile: "QUARTERLY",
      }),
    ).toMatchObject({
      observedPurchaseIntervalDays: 10,
      purchaseIntervalDays: 90,
      purchaseIntervalSource: "MANUAL",
      purchaseProfile: "QUARTERLY",
      manualPurchaseIntervalDays: null,
    });
  });

  test("applies a custom manual interval without discarding the observed interval", () => {
    expect(
      calculate({
        purchaseDates: ["2026-07-20", "2026-07-10"],
        manualProfile: "CUSTOM",
        manualIntervalDays: 45,
      }),
    ).toMatchObject({
      observedPurchaseIntervalDays: 10,
      purchaseIntervalDays: 45,
      purchaseIntervalSource: "MANUAL",
      purchaseProfile: "CUSTOM",
      manualPurchaseIntervalDays: 45,
    });
  });

  test("clears an override when the manual profile and days are null", () => {
    expect(
      calculate({
        purchaseDates: ["2026-07-20", "2026-07-10"],
        manualProfile: null,
        manualIntervalDays: null,
      }),
    ).toMatchObject({
      observedPurchaseIntervalDays: 10,
      purchaseIntervalDays: 10,
      purchaseIntervalSource: "CALCULATED",
      purchaseProfile: null,
      manualPurchaseIntervalDays: null,
    });

    expect(
      calculate({ manualProfile: null, manualIntervalDays: null }),
    ).toMatchObject({
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "DEFAULT",
    });
  });

  test.each([0, 1.5, 3651, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid custom interval %p with a typed validation error",
    (manualIntervalDays) => {
      expect(() =>
        calculate({ manualProfile: "CUSTOM", manualIntervalDays }),
      ).toThrow(PurchaseRecurrenceValidationError);
    },
  );

  test("rejects missing custom days and arbitrary days for preset or automatic profiles", () => {
    expect(() =>
      calculate({ manualProfile: "CUSTOM", manualIntervalDays: null }),
    ).toThrow("CUSTOM requires manualIntervalDays");
    expect(() =>
      calculate({ manualProfile: "MONTHLY", manualIntervalDays: 31 }),
    ).toThrow("manualIntervalDays must be null for preset profiles");
    expect(() =>
      calculate({ manualProfile: null, manualIntervalDays: 30 }),
    ).toThrow("manualIntervalDays must be null without a manual profile");
  });

  test("rejects invalid purchase and today dates with a typed validation error", () => {
    expect(() => calculate({ purchaseDates: ["not-a-date"] })).toThrow(
      PurchaseRecurrenceValidationError,
    );
    expect(() => calculate({ today: "2026-02-30" })).toThrow(
      PurchaseRecurrenceValidationError,
    );
  });

  test.each([
    ["2026-07-08", "OUTSIDE_WINDOW", "2026-07-23"],
    ["2026-07-07", "PURCHASE_WINDOW", "2026-09-05"],
    ["2026-05-24", "PURCHASE_WINDOW", "2026-07-23"],
    ["2026-05-23", "CHURN", "2026-08-21"],
    ["2026-04-24", "CHURN", "2026-07-23"],
    ["2026-04-23", "INACTIVE", null],
  ] as const)(
    "places last purchase %s at the exact funnel boundary in %s",
    (lastPurchase, purchaseFunnelStage, nextPurchaseFunnelTransitionDate) => {
      expect(calculate({ purchaseDates: [lastPurchase] })).toMatchObject({
        purchaseFunnelStage,
        nextPurchaseFunnelTransitionDate,
      });
    },
  );

  test("keeps a future last purchase outside the window with a future transition", () => {
    expect(calculate({ purchaseDates: ["2026-08-01"] })).toMatchObject({
      purchaseFunnelStage: "OUTSIDE_WINDOW",
      nextPurchaseFunnelTransitionDate: "2026-08-16",
    });
  });
});
