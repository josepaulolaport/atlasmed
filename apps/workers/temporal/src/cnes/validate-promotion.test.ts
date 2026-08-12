import { describe, expect, test } from "bun:test";
import { COLLAPSE_RATIO, judgePromotion } from "./validate-promotion";

const healthy = {
  scopedFacilities: 1423,
  facilitiesUpserted: 1423,
  professionals: 19137,
  registrations: 19173,
  vinculos: 25217,
  occupationLinks: 26124,
};

const baseline = {
  runId: 1,
  reference: "2026-05",
  vinculos: 25217,
  professionals: 19137,
};

describe("promotion gate", () => {
  test("promotes a run that matches the previous month", () => {
    const result = judgePromotion({ summary: healthy, baseline });
    expect(result.decision).toBe("PROMOTE");
    expect(result.reasons).toEqual([]);
  });

  test("promotes ordinary month-to-month drift", () => {
    // Staff turnover moves these by percents, not multiples.
    const result = judgePromotion({
      summary: { ...healthy, vinculos: 24100, professionals: 18500 },
      baseline,
    });
    expect(result.decision).toBe("PROMOTE");
  });

  test("refuses when vínculos collapse against the last good run", () => {
    const result = judgePromotion({
      summary: { ...healthy, vinculos: 900 },
      baseline,
    });
    expect(result.decision).toBe("REFUSE");
    // The numbers belong in the message: "validation failed" sends someone to
    // the logs, "25217 → 900" sends them to the export.
    expect(result.reasons.join(" ")).toContain("25217");
    expect(result.reasons.join(" ")).toContain("900");
  });

  test("refuses when professionals collapse even if vínculos hold", () => {
    const result = judgePromotion({
      summary: { ...healthy, professionals: 100 },
      baseline,
    });
    expect(result.decision).toBe("REFUSE");
  });

  test("refuses an export that yielded no vínculos at all", () => {
    // The case my own test fixture hit: one clinic's worth of carga wiped the
    // roster of the other 1422.
    const result = judgePromotion({
      summary: { ...healthy, vinculos: 0 },
      baseline: null,
    });
    expect(result.decision).toBe("REFUSE");
  });

  test("refuses when no facility is in scope", () => {
    const result = judgePromotion({
      summary: { ...healthy, scopedFacilities: 0, vinculos: 0 },
      baseline: null,
    });
    expect(result.decision).toBe("REFUSE");
    expect(result.reasons.join(" ")).toContain("cnes_code");
  });

  test("promotes the very first run, which has nothing to compare against", () => {
    // Otherwise the gate would make it impossible to load the first month.
    const result = judgePromotion({ summary: healthy, baseline: null });
    expect(result.decision).toBe("PROMOTE");
  });

  test("sits exactly on the threshold without refusing", () => {
    const onFloor = Math.floor(baseline.vinculos * COLLAPSE_RATIO);
    const result = judgePromotion({
      summary: { ...healthy, vinculos: onFloor },
      baseline,
    });
    expect(result.decision).toBe("PROMOTE");
  });
});
