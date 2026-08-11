import { describe, expect, it } from "bun:test";
import { buildScopedProfilesQuery } from "./drizzle-dashboard.repository";
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
    repUserId: null,
    stateId: null,
    municipalityId: null,
    unitTypeId: null,
    ...overrides,
  };
}

const scopes: Array<{ name: string; filter: DashboardProfileFilter }> = [
  { name: "global (admin)", filter: filter() },
  { name: "manager zones", filter: filter({ zoneIds: [7, 9] }) },
  { name: "rep assignment", filter: filter({ repUserId: 42 }) },
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
  }

  it("scopes a manager by derived zone membership", () => {
    const { sql } = buildScopedProfilesQuery(filter({ zoneIds: [7, 9] })).toSQL();
    expect(sql).toContain(`"facility_vertical_profiles"."manager_zone_id" in`);
  });

  it("scopes a rep by an open assignment, not by zone", () => {
    const { sql } = buildScopedProfilesQuery(filter({ repUserId: 42 })).toSQL();
    expect(sql).toContain(`facility_vertical_rep_assignments`);
    expect(sql).toContain(`"ended_at" is null`);
    expect(sql).not.toContain(`"manager_zone_id" in`);
  });

  it("applies geography and unit-type filters to the same predicate", () => {
    const { sql } = buildScopedProfilesQuery(
      filter({ stateId: 35, municipalityId: 3550308, unitTypeId: 4 }),
    ).toSQL();

    expect(sql).toContain(`"facilities"."state_id" = `);
    expect(sql).toContain(`"facilities"."municipality_id" = `);
    expect(sql).toContain(`"facilities"."unit_type_id" = `);
  });
});
