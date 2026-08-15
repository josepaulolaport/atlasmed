import { describe, expect, it } from "bun:test";
import {
  buildCpfIssueCountsQuery,
  buildScopedProfilesQuery,
} from "./drizzle-dashboard.repository";
import type { DashboardProfileFilter } from "../../application/dashboard-query";

/**
 * API tests are unit-only (see `src/test-setup.ts` — no database is seeded), so
 * these invariants are asserted on the emitted SQL: a deactivated facility can
 * only be excluded from a count if the query that produces it filters
 * `facilities.deactivated_at`. Spec 0014 §4/§7.5.
 */
function filter(
  overrides: Partial<DashboardProfileFilter> = {},
): DashboardProfileFilter {
  return {
    verticalId: 1,
    zoneIds: null,
    repUserIds: null,
    stateIds: null,
    municipalityIds: null,
    unitTypeIds: null,
    ...overrides,
  };
}

const scopes: Array<{ name: string; filter: DashboardProfileFilter }> = [
  { name: "global (admin)", filter: filter() },
  { name: "manager zones", filter: filter({ zoneIds: [7, 9] }) },
  { name: "rep assignment", filter: filter({ repUserIds: [42] }) },
];

describe("dashboard scope predicate", () => {
  for (const scope of scopes) {
    it(`excludes deactivated facilities — ${scope.name}`, () => {
      const { sql } = buildScopedProfilesQuery(scope.filter).toSQL();
      expect(sql).toContain(`"facilities"."deactivated_at" is null`);
    });

    it(`keeps profile is_active as a separate predicate — ${scope.name}`, () => {
      const { sql } = buildScopedProfilesQuery(scope.filter).toSQL();
      expect(sql).toContain(`"facility_vertical_profiles"."is_active"`);
    });

    it(`pins exactly one vertical — ${scope.name}`, () => {
      const { sql } = buildScopedProfilesQuery(scope.filter).toSQL();
      // Spec 0014 §3: never a set, never "all" — one linha or the number is
      // meaningless.
      expect(sql).toContain(`"facility_vertical_profiles"."vertical_id" = `);
      expect(sql).not.toContain(`"facility_vertical_profiles"."vertical_id" in`);
    });

    it(`scopes the CPF counts exactly like every other metric — ${scope.name}`, () => {
      // The warning sits in the same card stack as the donut. If it were scoped
      // differently, whichever number the rep checked second would look wrong,
      // and neither would be provably right. It arrived taking its own
      // vertical/facility pair, which is how it came to ignore the filter bar.
      const cpf = buildCpfIssueCountsQuery(scope.filter).toSQL();
      const profiles = buildScopedProfilesQuery(scope.filter).toSQL();

      for (const fragment of [
        `"facilities"."deactivated_at" is null`,
        `"facility_vertical_profiles"."is_active"`,
        `"facility_vertical_profiles"."vertical_id" = `,
      ]) {
        expect(cpf.sql).toContain(fragment);
        expect(profiles.sql).toContain(fragment);
      }

      // The scope restriction is the half that leaks if it is forgotten:
      // without it a rep would be told about clinics they cannot even open.
      if (scope.filter.zoneIds !== null) {
        expect(cpf.sql).toContain(
          `"facility_vertical_profiles"."manager_zone_id" in`,
        );
      }
      if (scope.filter.repUserIds !== null) {
        expect(cpf.sql).toContain(`facility_vertical_rep_assignments`);
      }
    });
  }

  describe("CPF issue counts", () => {
    const render = () => buildCpfIssueCountsQuery(filter()).toSQL().sql;

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

  it("scopes a manager by derived zone membership", () => {
    const { sql } = buildScopedProfilesQuery(filter({ zoneIds: [7, 9] })).toSQL();
    expect(sql).toContain(`"facility_vertical_profiles"."manager_zone_id" in`);
  });

  it("scopes a rep by an open assignment, not by zone", () => {
    const { sql } = buildScopedProfilesQuery(filter({ repUserIds: [42] })).toSQL();
    expect(sql).toContain(`facility_vertical_rep_assignments`);
    expect(sql).toContain(`"ended_at" is null`);
    expect(sql).not.toContain(`"manager_zone_id" in`);
  });

  it("applies geography and unit-type filters to the same predicate", () => {
    const { sql } = buildScopedProfilesQuery(
      filter({
        stateIds: [35, 33],
        municipalityIds: [3550308],
        unitTypeIds: [4],
      }),
    ).toSQL();

    // Multi-select throughout (spec 0014 §5), so every one of them is an `in`
    // even when only one value is chosen — a filter that silently became `=`
    // on a single value would work until someone picked a second.
    expect(sql).toContain(`"facilities"."state_id" in `);
    expect(sql).toContain(`"facilities"."municipality_id" in `);
    expect(sql).toContain(`"facilities"."unit_type_id" in `);
  });
});
