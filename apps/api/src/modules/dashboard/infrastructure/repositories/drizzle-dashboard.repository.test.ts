import { describe, expect, it } from "bun:test";
import {
  buildDoctorCountQuery,
  buildPurchaseBucketsQuery,
} from "./drizzle-dashboard.repository";

/**
 * API tests are unit-only (see `src/test-setup.ts` — no database is seeded), so
 * the exclusion is asserted on the emitted SQL: a deactivated facility can only
 * be excluded from a count if the query that produces it filters
 * `facilities.deactivated_at`. Spec 0014 §4/§7.5.
 */
const scopes: { name: string; facilityIds: number[] | null }[] = [
  { name: "global scope (admin)", facilityIds: null },
  { name: "facility-restricted scope (rep/manager)", facilityIds: [7, 9] },
];

describe("dashboard counts exclude deactivated facilities", () => {
  for (const scope of scopes) {
    it(`filters deactivated facilities out of the purchase buckets — ${scope.name}`, () => {
      const { sql } = buildPurchaseBucketsQuery({
        verticalIds: [1],
        facilityIds: scope.facilityIds,
      }).toSQL();

      expect(sql).toContain(`"facilities"."deactivated_at" is null`);
    });

    it(`filters deactivated facilities out of the doctor count — ${scope.name}`, () => {
      const { sql } = buildDoctorCountQuery({
        verticalIds: [1],
        facilityIds: scope.facilityIds,
      }).toSQL();

      expect(sql).toContain(`"facilities"`);
      expect(sql).toContain(`"facilities"."deactivated_at" is null`);
    });
  }

  it("counts each funnel stage separately rather than pre-grouping them", () => {
    // Grouping is a presentation choice. When it lived in this SQL, the counts
    // for PURCHASE_WINDOW and OUTSIDE_WINDOW were summed server-side and no
    // client could tell "due to buy now" from "recently served".
    const { sql } = buildPurchaseBucketsQuery({
      verticalIds: [1],
      facilityIds: null,
    }).toSQL();

    for (const stage of [
      "NEVER_PURCHASED",
      "OUTSIDE_WINDOW",
      "PURCHASE_WINDOW",
      "CHURN",
      "INACTIVE",
    ]) {
      expect(sql).toContain(`= '${stage}'`);
    }
    expect(sql).not.toContain("IN ('OUTSIDE_WINDOW', 'CHURN')");
  });

  it("keeps profile is_active as a separate predicate, not a substitute", () => {
    const buckets = buildPurchaseBucketsQuery({
      verticalIds: [1],
      facilityIds: null,
    }).toSQL();
    const doctors = buildDoctorCountQuery({
      verticalIds: [1],
      facilityIds: null,
    }).toSQL();

    for (const { sql } of [buckets, doctors]) {
      expect(sql).toContain(`"facility_vertical_profiles"."is_active"`);
      expect(sql).toContain(`"facilities"."deactivated_at" is null`);
    }
  });
});
