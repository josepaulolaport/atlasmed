import { describe, expect, test } from "bun:test";
import { judgeImport } from "./validate-promotion";

/**
 * The counts from the 2026-05 load, which is the only shape of a healthy run
 * anyone has actually observed.
 */
const healthy = {
  scopedFacilities: 1423,
  facilitiesUpserted: 1423,
  professionals: 19137,
  registrations: 19173,
  vinculos: 25217,
  occupationLinks: 26124,
};

describe("import validation", () => {
  test("promotes a healthy run", () => {
    const result = judgeImport(healthy);
    expect(result.decision).toBe("PROMOTE");
    expect(result.reasons).toEqual([]);
  });

  test("promotes a month whose numbers moved a great deal", () => {
    // The point of the rules below: rosters churn, and a run is judged on
    // whether it read and wrote coherently, never on resembling last month.
    const result = judgeImport({
      ...healthy,
      professionals: 4_000,
      registrations: 4_010,
      vinculos: 5_100,
      occupationLinks: 5_300,
    });
    expect(result.decision).toBe("PROMOTE");
  });

  test("promotes a month that grew just as sharply", () => {
    const result = judgeImport({
      ...healthy,
      professionals: 61_000,
      registrations: 61_400,
      vinculos: 88_000,
      occupationLinks: 91_000,
    });
    expect(result.decision).toBe("PROMOTE");
  });

  test("refuses when no facility is in scope", () => {
    const result = judgeImport({
      ...healthy,
      scopedFacilities: 0,
      facilitiesUpserted: 0,
      vinculos: 0,
    });
    expect(result.decision).toBe("REFUSE");
    expect(result.reasons.join(" ")).toContain("cnes_code");
  });

  test("refuses when not one scoped clinic was found in the export", () => {
    // Every cnes_code being wrong at once is not plausible; a changed export is.
    const result = judgeImport({ ...healthy, facilitiesUpserted: 0, vinculos: 0 });
    expect(result.decision).toBe("REFUSE");
    expect(result.reasons.join(" ")).toContain("1423");
  });

  test("refuses an export that yielded no vínculos at all", () => {
    // The case my own test fixture hit: one clinic's worth of carga wiped the
    // roster of the other 1422.
    const result = judgeImport({ ...healthy, vinculos: 0 });
    expect(result.decision).toBe("REFUSE");
  });

  test("refuses when vínculos were built against no professionals", () => {
    const result = judgeImport({ ...healthy, professionals: 0, registrations: 0 });
    expect(result.decision).toBe("REFUSE");
    expect(result.reasons.join(" ")).toContain("25217");
  });

  test("refuses professionals written without a single registration", () => {
    // The registration is the join key the feature rests on; none of them
    // parsing means the identity half of the load is broken.
    const result = judgeImport({ ...healthy, registrations: 0 });
    expect(result.decision).toBe("REFUSE");
    expect(result.reasons.join(" ")).toContain("registration");
  });

  test("reports the root cause rather than a cascade of consequences", () => {
    // A run that loaded nothing fails every rule downstream of the first. Each
    // rule is guarded on its predecessor so the report names the one thing that
    // actually went wrong, not five restatements of it.
    const result = judgeImport({
      scopedFacilities: 0,
      facilitiesUpserted: 0,
      professionals: 0,
      registrations: 0,
      vinculos: 0,
      occupationLinks: 0,
    });
    expect(result.decision).toBe("REFUSE");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("cnes_code");
  });
});
