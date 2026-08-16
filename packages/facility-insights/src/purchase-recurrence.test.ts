import { describe, expect, test } from "bun:test";

import {
  PURCHASE_FUNNEL_STAGES,
  PURCHASE_INTERVAL_SOURCES,
  PURCHASE_PROFILES,
  PURCHASE_PROFILE_INTERVAL_DAYS,
  PurchaseRecurrenceValidationError,
  calculatePurchaseRecurrenceSnapshot,
} from "./index";

describe("purchase recurrence enum values", () => {
  test("exports the required ordered runtime tuples", () => {
    expect(PURCHASE_INTERVAL_SOURCES).toEqual(["DEFAULT", "CALCULATED", "MANUAL"]);
    expect(PURCHASE_PROFILES).toEqual([
      "WEEKLY",
      "BIWEEKLY",
      "MONTHLY",
      "BIMONTHLY",
      "QUARTERLY",
      "SEMIANNUAL",
      "ANNUAL",
      "CUSTOM",
    ]);
    expect(PURCHASE_FUNNEL_STAGES).toEqual([
      "NEVER_PURCHASED",
      "OUTSIDE_WINDOW",
      "PURCHASE_WINDOW",
      "CHURN",
      "INACTIVE",
    ]);
  });
});

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
      manualPurchaseProfile: null,
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

  test("takes the median of up to twelve consecutive intervals", () => {
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

  test("takes the middle gap of an odd sample rather than averaging", () => {
    // 10, 10 and 100 days apart, newest first.
    expect(
      calculate({
        purchaseDates: ["2026-07-20", "2026-07-10", "2026-06-30", "2026-03-22"],
      }),
    ).toMatchObject({
      // The mean would be 40 and would call this a six-week buyer.
      observedPurchaseIntervalDays: 10,
      purchaseIntervalDays: 10,
      purchaseRecurrenceSampleSize: 3,
    });
  });

  test("averages the two middle gaps of an even sample", () => {
    // 10, 12, 14 and 400 days apart, newest first.
    expect(
      calculate({
        purchaseDates: [
          "2026-07-20",
          "2026-07-10",
          "2026-06-28",
          "2026-06-14",
          "2025-05-11",
        ],
      }),
    ).toMatchObject({
      observedPurchaseIntervalDays: 13,
      purchaseRecurrenceSampleSize: 4,
    });
  });

  /**
   * The production case this switch was made for: eleven gaps between 23 and 61
   * days and one of 293. The mean reports 59 and leaves the clinic in
   * PURCHASE_WINDOW at 87 days silent; it is a monthly buyer two and a half
   * cycles overdue.
   */
  test("a lone dormancy does not excuse a churning clinic", () => {
    const gaps = [23, 24, 31, 33, 34, 35, 35, 40, 46, 50, 61, 293];
    let day = Date.UTC(2026, 4, 20);
    const purchaseDates = ["2026-05-20"];
    for (const gap of gaps) {
      day -= gap * 86_400_000;
      purchaseDates.push(new Date(day).toISOString().slice(0, 10));
    }

    expect(calculate({ purchaseDates, today: "2026-08-15" })).toMatchObject({
      observedPurchaseIntervalDays: 35,
      purchaseIntervalDays: 35,
      purchaseRecurrenceSampleSize: 12,
      purchaseFunnelStage: "CHURN",
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

  test("sorts unsorted input and uses only the thirteen most recent distinct purchase dates", () => {
    const purchaseDates = [
      "2020-01-01",
      ...Array.from({ length: 13 }, (_, index) =>
        new Date(Date.UTC(2026, 6, 20 - index * 2)).toISOString(),
      ).reverse(),
      "2019-01-01",
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

  test("deduplicates zero-day purchases before calculating the interval", () => {
    expect(
      calculate({
        purchaseDates: [
          "2026-07-20T00:00:00Z",
          "2026-07-20T23:59:59Z",
          "2026-07-19T12:00:00Z",
        ],
      }),
    ).toMatchObject({
      observedPurchaseIntervalDays: 1,
      purchaseIntervalDays: 1,
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
      manualPurchaseProfile: "QUARTERLY",
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
      manualPurchaseProfile: "CUSTOM",
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
      manualPurchaseProfile: null,
      manualPurchaseIntervalDays: null,
    });

    expect(
      calculate({ manualProfile: null, manualIntervalDays: null }),
    ).toMatchObject({
      purchaseIntervalDays: 30,
      purchaseIntervalSource: "DEFAULT",
    });
  });

  test.each([1, 3650])("accepts CUSTOM boundary %d", (manualIntervalDays) => {
    expect(
      calculate({ manualProfile: "CUSTOM", manualIntervalDays }),
    ).toMatchObject({
      purchaseIntervalDays: manualIntervalDays,
      purchaseIntervalSource: "MANUAL",
      manualPurchaseProfile: "CUSTOM",
      manualPurchaseIntervalDays: manualIntervalDays,
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

  test.each([
    "2026-07-20T12:00:00",
    "2026/07/20",
    "2026-07-20 12:00:00Z",
    "2026-02-30T00:00:00Z",
  ])("rejects non-strict purchase date %s with stable code and index", (purchaseDate) => {
    try {
      calculate({ purchaseDates: ["2026-07-20", purchaseDate] });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseRecurrenceValidationError);
      expect(error).toMatchObject({
        field: "purchaseDates",
        code: "INVALID_DATE",
        index: 1,
      });
    }
  });

  test("rejects an impossible today civil date with a stable code and no index", () => {
    try {
      calculate({ today: "2026-02-30" });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(PurchaseRecurrenceValidationError);
      expect(error).toMatchObject({
        field: "today",
        code: "INVALID_DATE",
        index: undefined,
      });
    }
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

  test.each([
    ["2026-07-15", "OUTSIDE_WINDOW", "2026-07-23"],
    ["2026-07-14", "PURCHASE_WINDOW", "2026-08-13"],
  ] as const)(
    "uses ceil half interval for BIWEEKLY at last purchase %s",
    (lastPurchase, purchaseFunnelStage, nextPurchaseFunnelTransitionDate) => {
      expect(
        calculate({ purchaseDates: [lastPurchase], manualProfile: "BIWEEKLY" }),
      ).toMatchObject({
        purchaseFunnelStage,
        nextPurchaseFunnelTransitionDate,
      });
    },
  );

  test.each([
    ["2024-02-29", "2024-03-01"],
    ["2026-01-31", "2026-02-01"],
  ] as const)(
    "calculates one-day intervals across calendar transition %s to %s",
    (earlierPurchase, laterPurchase) => {
      expect(
        calculate({
          purchaseDates: [earlierPurchase, laterPurchase],
          today: laterPurchase,
        }),
      ).toMatchObject({
        observedPurchaseIntervalDays: 1,
        purchaseIntervalDays: 1,
        lastValidPurchaseDate: laterPurchase,
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
