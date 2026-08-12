import { describe, expect, it } from "bun:test";
import {
  APPLICATION_TIMEZONE,
  MarketMetricValidationError,
  addMonths,
  averageMonthly,
  deriveShare,
  monthBounds,
  monthKeyAt,
  monthlyRateFromDays,
  rollingWindow,
  trailingMonths,
} from "./market-metric";

describe("monthKeyAt", () => {
  it("files a late-evening São Paulo order under the month the rep would name", () => {
    // 31 March 22:00 in São Paulo is 1 April 01:00 UTC. Filing this under April
    // is the off-by-one the timezone decision exists to prevent.
    const instant = new Date("2026-04-01T01:00:00.000Z");
    expect(monthKeyAt(instant)).toBe("2026-03-01");
    expect(monthKeyAt(instant, "UTC")).toBe("2026-04-01");
  });

  it("files an early-morning order under the same month in both zones", () => {
    const instant = new Date("2026-04-02T12:00:00.000Z");
    expect(monthKeyAt(instant)).toBe("2026-04-01");
    expect(monthKeyAt(instant, "UTC")).toBe("2026-04-01");
  });

  it("agrees with UTC for Emultec's noon-UTC stamps", () => {
    // Every production order is an Emultec import stamped at noon UTC precisely
    // so its date component survives the conversion. Nothing should move.
    for (const day of ["2026-01-01", "2026-03-31", "2026-08-07", "2026-12-31"]) {
      const instant = new Date(`${day}T12:00:00.000Z`);
      expect(monthKeyAt(instant)).toBe(monthKeyAt(instant, "UTC"));
    }
  });
});

describe("monthBounds", () => {
  it("returns a half-open interval anchored to São Paulo midnight", () => {
    const { start, end } = monthBounds("2026-04-01");
    // São Paulo is UTC-3, so local midnight on 1 April is 03:00 UTC.
    expect(start.toISOString()).toBe("2026-04-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-01T03:00:00.000Z");
  });

  it("excludes its upper bound, so a month boundary is counted once", () => {
    const march = monthBounds("2026-03-01");
    const april = monthBounds("2026-04-01");
    expect(march.end.getTime()).toBe(april.start.getTime());

    const boundary = april.start;
    const inMarch = boundary.getTime() >= march.start.getTime() && boundary.getTime() < march.end.getTime();
    const inApril = boundary.getTime() >= april.start.getTime() && boundary.getTime() < april.end.getTime();
    expect(inMarch).toBe(false);
    expect(inApril).toBe(true);
  });

  it("rolls the year at December", () => {
    const { start, end } = monthBounds("2026-12-01");
    expect(start.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("brackets every instant it should, checked against monthKeyAt", () => {
    // The two functions are independent implementations of the same boundary.
    // If they ever disagree, one of them silently misfiles orders.
    const instants = [
      "2026-02-28T14:00:00.000Z",
      "2026-03-01T02:59:59.999Z",
      "2026-03-01T03:00:00.000Z",
      "2026-04-01T01:00:00.000Z",
      "2026-04-01T03:00:00.000Z",
      "2026-12-31T23:00:00.000Z",
    ];
    for (const iso of instants) {
      const instant = new Date(iso);
      const { start, end } = monthBounds(monthKeyAt(instant));
      expect(instant.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(instant.getTime()).toBeLessThan(end.getTime());
    }
  });

  it("rejects a date that is not the first of a month", () => {
    expect(() => monthBounds("2026-04-15")).toThrow(MarketMetricValidationError);
  });

  it("rejects a month outside 01–12", () => {
    expect(() => monthBounds("2026-13-01")).toThrow(MarketMetricValidationError);
  });
});

describe("addMonths", () => {
  it("moves forward and backward across year boundaries", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-08-01", -12)).toBe("2025-08-01");
    expect(addMonths("2026-08-01", 0)).toBe("2026-08-01");
  });

  it("stays consistent when stepped one month at a time across a year", () => {
    let month = "2025-11-01";
    for (let step = 0; step < 14; step += 1) month = addMonths(month, 1);
    expect(month).toBe("2027-01-01");
  });
});

describe("trailingMonths", () => {
  it("returns the window oldest-first, ending at the requested month", () => {
    expect(trailingMonths("2026-03-01", 3)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("crosses a year boundary", () => {
    expect(trailingMonths("2026-01-01", 3)).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
    ]);
  });

  it("rejects a non-positive window", () => {
    expect(() => trailingMonths("2026-03-01", 0)).toThrow(MarketMetricValidationError);
  });
});

describe("deriveShare", () => {
  it("is null, never 0, when nothing is known", () => {
    // The distinction the whole metric rests on: no sales and no information
    // must not collapse into the same number.
    expect(deriveShare(0, 0, false)).toEqual({ totalQty: 0, share: null });
  });

  it("is 0 when we genuinely sell nothing into a known market", () => {
    expect(deriveShare(0, 40, false)).toEqual({ totalQty: 40, share: 0 });
  });

  it("is null when we have orders but nobody has looked at the market", () => {
    // The §4.6 rule. Ours is 30 and theirs is 0, but that 0 means "nothing
    // recorded", not "nothing there" — so 100% would be a claim to own a market
    // no one has measured. This case read 1 before the claim existed, which is
    // how every unsurveyed clinic reported that we owned it outright.
    expect(deriveShare(30, 0, false)).toEqual({ totalQty: 30, share: null });
  });

  it("is 1 once a rep says there is no other brand here", () => {
    // Same operands, one assertion added. The claim is what turns an unknown
    // denominator into a known one.
    expect(deriveShare(30, 0, true)).toEqual({ totalQty: 30, share: 1 });
  });

  it("is null with the claim but nothing at all to divide", () => {
    // "No other brand here" and no orders either: the market is known to be
    // empty, and our share of an empty market is not a number.
    expect(deriveShare(0, 0, true)).toEqual({ totalQty: 0, share: null });
  });

  it("splits a mixed market", () => {
    expect(deriveShare(30, 10, false)).toEqual({ totalQty: 40, share: 0.75 });
  });

  it("does not need the claim once a competitor is recorded", () => {
    // A recorded competitor *is* the observation; the claim adds nothing and,
    // per the table's check constraint, cannot coexist with one anyway.
    expect(deriveShare(30, 10, false)).toEqual(deriveShare(30, 10, true));
  });
});

describe("averageMonthly", () => {
  it("divides by the window, not by the months supplied", () => {
    // One month of 30 across a three-month window is an average of 10 — the
    // silent months are real zeros, not missing data.
    expect(averageMonthly([30, 0, 0], 3)).toBe(10);
  });

  it("treats an empty history as zero rather than dividing by zero", () => {
    expect(averageMonthly([], 3)).toBe(0);
  });

  it("rejects a non-positive window", () => {
    expect(() => averageMonthly([1], 0)).toThrow(MarketMetricValidationError);
  });
});

describe("APPLICATION_TIMEZONE", () => {
  it("is São Paulo, because the rep's months are the product's months", () => {
    expect(APPLICATION_TIMEZONE).toBe("America/Sao_Paulo");
  });
});

describe("rolling window", () => {
  it("is half-open and exactly the requested number of days", () => {
    const { start, end } = rollingWindow(new Date("2026-03-05T12:00:00.000Z"), 90);
    expect(end.toISOString()).toBe("2026-03-05T12:00:00.000Z");
    expect((end.getTime() - start.getTime()) / 86_400_000).toBe(90);
  });

  it("does not understate a steady clinic early in the month", () => {
    // The defect this replaces: on the 5th, three *calendar* months divides two
    // full months plus five days by three. A clinic selling 30/month reads ~21.
    const calendarStyle = averageMonthly([30, 30, 5], 3);
    const rolling = monthlyRateFromDays(90, 90);
    expect(calendarStyle).toBeCloseTo(21.67, 1);
    expect(rolling).toBe(30);
  });

  it("normalises by the days actually covered", () => {
    expect(monthlyRateFromDays(90, 90)).toBe(30);
    expect(monthlyRateFromDays(45, 90)).toBe(15);
    expect(monthlyRateFromDays(0, 90)).toBe(0);
  });

  it("rejects a non-positive window", () => {
    expect(() => rollingWindow(new Date(), 0)).toThrow(MarketMetricValidationError);
    expect(() => monthlyRateFromDays(1, 0)).toThrow(MarketMetricValidationError);
  });
});
