import { describe, expect, test } from "bun:test";
import { isDatabaseReachable } from "../../../../test-utils/db-harness";
import { DrizzleDashboardDirectoryRepository } from "./drizzle-dashboard-directory.repository";
import { DrizzleDashboardRepository } from "./drizzle-dashboard.repository";
import { DrizzleTeamRepository } from "./drizzle-team.repository";
import type { DashboardProfileFilter } from "../../application/dashboard-query";

/**
 * Every dashboard query, executed against a real Postgres.
 *
 * The sibling `drizzle-dashboard.repository.test.ts` asserts query *shape* —
 * that a count filters `deactivated_at` — which is the right tool for an
 * invariant about a predicate. It cannot catch a statement that never runs, and
 * one did not: `countOrders` bound two `Date` values inside a raw `sql`
 * template, where there is no column for the driver to infer an encoder from,
 * so postgres-js rejected it at Bind time and `GET /dashboard/metrics/orders`
 * was a 500 on every call. The shape test passed the whole time, because the
 * SQL it emitted was fine.
 *
 * So these run the statements. They seed nothing and assert only what is true
 * of any dataset — including an empty one — which is what makes them safe to
 * run against a snapshot clone, and enough to prove a query is executable and
 * internally consistent.
 */
const dbUp = await isDatabaseReachable();

const repository = new DrizzleDashboardRepository();
const team = new DrizzleTeamRepository();
const directory = new DrizzleDashboardDirectoryRepository();

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

describe.skipIf(!dbUp)("dashboard queries (database)", () => {
  test("pedidos counts both windows — the regression", async () => {
    const now = new Date();
    const counts = await repository.countOrders({
      filter: filter(),
      ranges: [
        {
          key: "week",
          start: new Date(now.getTime() - 7 * 86_400_000),
          end: now,
        },
        {
          key: "month",
          start: new Date(now.getTime() - 30 * 86_400_000),
          end: now,
        },
      ],
    });

    expect(Number.isInteger(counts.week)).toBe(true);
    expect(Number.isInteger(counts.month)).toBe(true);
    // The wider window cannot contain fewer orders than the narrower one it
    // encloses — the cheapest assertion that the bounds are actually applied
    // rather than ignored.
    expect(counts.month).toBeGreaterThanOrEqual(counts.week!);
  });

  test("penetração média returns one row per definition, share within 0–1", async () => {
    const rows = await repository.averageShareByDefinition({
      filter: filter(),
      months: ["2026-06-01", "2026-07-01", "2026-08-01"],
    });

    for (const row of rows) {
      expect(row.clinicsCounted).toBeGreaterThanOrEqual(0);
      if (row.meanShare !== null) {
        expect(row.meanShare).toBeGreaterThanOrEqual(0);
        expect(row.meanShare).toBeLessThanOrEqual(1);
        // A mean exists only if a clinic contributed to it.
        expect(row.clinicsCounted).toBeGreaterThan(0);
      }
    }
  });

  test("a card and its drill-down count the same clinics", async () => {
    const scope = filter();
    const [total, page] = await Promise.all([
      repository.countProfiles(scope),
      repository.listScopedClinics({ filter: scope, offset: 0, limit: 1 }),
    ]);

    // Spec 0014 §4.1: the breakdown is the card's own query plus one condition,
    // so a join that silently dropped rows (a missing municipality, say) would
    // show here as a drill-down listing fewer clinics than the number above it.
    expect(page.total).toBe(total);
  });

  test("buckets partition the denominator", async () => {
    const buckets = await repository.countPurchaseBuckets(filter());
    expect(buckets.active + buckets.inactive + buckets.neverBought).toBe(
      buckets.total,
    );

    const registered = await repository.countRegisteredProfiles(filter());
    expect(registered.total).toBe(buckets.total);
    expect(registered.registered).toBeLessThanOrEqual(registered.total);

    const withoutRep = await repository.countProfilesWithoutRep(filter());
    expect(withoutRep).toBeLessThanOrEqual(buckets.total);
  });

  test("an empty zone list matches nothing rather than everything", async () => {
    // The use case short-circuits before reaching here, but the predicate has
    // to mean the same thing on its own: `IN ()` widening to unrestricted is
    // exactly how a manager with no zones would come to see the whole country.
    expect(await repository.countProfiles(filter({ zoneIds: [] }))).toBe(0);
  });

  test("the roster queries and the directory run", async () => {
    expect(Array.isArray(await team.listManagers(1))).toBe(true);
    expect(
      Array.isArray(await team.listRepsUnderZones({ verticalId: 1, zoneIds: [1] })),
    ).toBe(true);
    expect(Array.isArray(await team.listRepsWithoutPatch())).toBe(true);
    expect(
      Array.isArray(
        await directory.findManagerZoneIds({ userId: 1, verticalId: 1 }),
      ),
    ).toBe(true);
  });

  test("every filter facet offers only what exists in scope", async () => {
    const [states, municipalities, managers, reps] = await Promise.all([
      repository.listStateOptions(filter()),
      repository.listMunicipalityOptions(filter()),
      repository.listManagerOptions(filter()),
      repository.listRepOptions(filter()),
    ]);

    for (const list of [states, municipalities, managers, reps]) {
      for (const option of list) {
        expect(Number.isInteger(option.id)).toBe(true);
        // `COALESCE(..., email)` exists so a user with no name is still
        // pickable; an unlabelled option is an option nobody can choose.
        expect(option.label.length).toBeGreaterThan(0);
      }
    }

    // A municipality can only exist inside a state that also has clinics here,
    // so the geography facets can never contradict each other.
    if (municipalities.length > 0) expect(states.length).toBeGreaterThan(0);
  });

  test("narrowing one facet narrows the ones below it", async () => {
    const allStates = await repository.listStateOptions(filter());
    if (allStates.length === 0) return;

    const wide = await repository.listMunicipalityOptions(filter());
    const narrow = await repository.listMunicipalityOptions(
      filter({ stateIds: [allStates[0]!.id] }),
    );

    // Spec 0014 §5: choose a state and the municipality drawer offers that
    // state's municipalities. Narrowing that widened the list would mean the
    // predicate was being ignored.
    expect(narrow.length).toBeLessThanOrEqual(wide.length);
    const wideIds = new Set(wide.map((o) => o.id));
    for (const option of narrow) expect(wideIds.has(option.id)).toBe(true);
  });

  test("the territory card reads boundaries as GeoJSON", async () => {
    const features = await repository.listVerticalTerritoryFeatures(1);
    for (const feature of features) {
      expect(typeof feature.name).toBe("string");
      // Parsed, not the raw string ST_AsGeoJSON returns.
      expect(feature.boundary).toBeTypeOf("object");
    }
    expect(
      Array.isArray(
        await repository.listAssignedTerritoryFeatures({
          userId: 1,
          verticalId: 1,
        }),
      ),
    ).toBe(true);
    expect(await repository.countDoctors(filter())).toBeGreaterThanOrEqual(0);
  });
});
