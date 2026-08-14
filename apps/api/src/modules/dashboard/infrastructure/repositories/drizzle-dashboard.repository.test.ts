import { describe, expect, it } from "bun:test";
import {
  buildCpfIssueCountsQuery,
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

    it(`scopes the CPF counts exactly like the purchase buckets — ${scope.name}`, () => {
      // The warning sits in the same card stack as the donut. If it were scoped
      // differently, whichever number the rep checked second would look wrong,
      // and neither would be provably right.
      const cpf = buildCpfIssueCountsQuery({
        verticalIds: [1],
        facilityIds: scope.facilityIds,
      }).toSQL();
      const buckets = buildPurchaseBucketsQuery({
        verticalIds: [1],
        facilityIds: scope.facilityIds,
      }).toSQL();

      for (const fragment of [
        `"facilities"."deactivated_at" is null`,
        `"facility_vertical_profiles"."is_active"`,
        `"facility_vertical_profiles"."vertical_id" in`,
      ]) {
        expect(cpf.sql).toContain(fragment);
        expect(buckets.sql).toContain(fragment);
      }

      // The facility restriction is the half that leaks if it is forgotten:
      // without it a rep would be told about clinics they cannot even open.
      if (scope.facilityIds !== null) {
        expect(cpf.sql).toContain(
          `"facility_vertical_profiles"."facility_id" in`,
        );
      }
    });
  }

  describe("CPF issue counts", () => {
    const render = () =>
      buildCpfIssueCountsQuery({ verticalIds: [1], facilityIds: null }).toSQL()
        .sql;

    it("counts clinics, not profiles", () => {
      // The bucket counts count profiles, so a clinic in two linhas counts
      // twice. A clinic has one CPF however many linhas it sells, and counting
      // rows would send the rep to a list shorter than the number that opened
      // it.
      expect(render()).toContain("COUNT(DISTINCT");
    });

    it("only looks at CPF clinics", () => {
      expect(render()).toContain(`"facilities"."legal_document_type" = `);
    });

    it("treats a blank document as missing and keeps it out of invalid", () => {
      const sql = render();
      expect(sql).toContain("btrim");
      // Both filters derive from the same blank test, one negated — which is
      // what makes the two counts disjoint. Were they written independently,
      // a clinic with a blank document could be reported under both.
      expect(sql).toContain("NOT");
      expect(sql).toContain("is_valid_cpf");
    });
  });

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
