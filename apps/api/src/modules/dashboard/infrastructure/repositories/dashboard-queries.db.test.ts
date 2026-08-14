import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
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
    // No month argument since spec 0013 §4.6: one snapshot row per (clinic,
    // metric), so there is no window for a reader to choose.
    const rows = await repository.averageShareByDefinition({ filter: filter() });

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
    // Every profile lands in exactly one stage, `UNKNOWN` included — which is
    // what makes it safe for a client to regroup them. A stage missing from the
    // select would show up here as a sum short of the total.
    const summed = Object.values(buckets.stages).reduce((a, b) => a + b, 0);
    expect(summed).toBe(buckets.total);

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

describe.skipIf(!dbUp)("team member metrics (database)", () => {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

  test("computes every row metric for a roster in one pass", async () => {
    const reps = await team.listRepsUnderZones({
      verticalId: 1,
      zoneIds: [1, 2, 3, 4, 5],
    });
    if (reps.length === 0) return;

    const metrics = await team.findMemberMetrics({
      verticalId: 1,
      userIds: reps.map((r) => r.userId),
      scope: "rep",
      ordersFrom: monthAgo,
      ordersTo: now,
    });

    for (const rep of reps) {
      const row = metrics.get(rep.userId);
      if (row == null) continue;
      // The batched count must agree with the roster's own, or the header and
      // the row would disagree about the same person.
      expect(row.assignedClinics).toBe(rep.assignedClinicCount);
      expect(row.ordersMonth).toBeGreaterThanOrEqual(0);
      for (const percent of [row.coveragePercent, row.cadastroPercent]) {
        if (percent !== null) {
          expect(percent).toBeGreaterThanOrEqual(0);
          expect(percent).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test("a rep's figures narrow to the zones the reader owns (0015 R1)", async () => {
    const zones = await directory.findManagerZoneIds({ userId: 541, verticalId: 1 });
    if (zones.length === 0) return;

    const reps = await team.listRepsUnderZones({ verticalId: 1, zoneIds: zones });
    if (reps.length === 0) return;
    const userIds = reps.map((r) => r.userId);
    const window = { ordersFrom: monthAgo, ordersTo: now };

    const inTheirOwnZones = await team.findMemberMetrics({
      verticalId: 1,
      userIds,
      scope: "rep",
      withinZoneIds: zones,
      ...window,
    });
    const everywhere = await team.findMemberMetrics({
      verticalId: 1,
      userIds,
      scope: "rep",
      withinZoneIds: null,
      ...window,
    });

    // Narrowing can only remove clinics, never add them.
    for (const rep of reps) {
      expect(inTheirOwnZones.get(rep.userId)!.assignedClinics).toBeLessThanOrEqual(
        everywhere.get(rep.userId)?.assignedClinics ?? 0,
      );
    }

    // The predicate has to actually bite, and today's data cannot show that on
    // its own: every rep holds one patch under one manager, so scoped and
    // unscoped agree. Pointing it at ground they do not work proves the join is
    // applied rather than merely present.
    const elsewhere = await db.execute(sql`
      SELECT id FROM territories
       WHERE is_active = true AND vertical_id = 1
         AND id NOT IN (${sql.join(zones.map((id) => sql`${id}`), sql`, `)})
         AND territory_type_id = (SELECT id FROM territory_types WHERE slug = 'manager_zone')
       LIMIT 1
    `) as unknown as Array<{ id: number | string }>;

    if (elsewhere.length > 0) {
      const foreign = await team.findMemberMetrics({
        verticalId: 1,
        userIds,
        scope: "rep",
        withinZoneIds: [Number(elsewhere[0]!.id)],
        ...window,
      });
      for (const rep of reps) {
        expect(foreign.get(rep.userId)?.assignedClinics ?? 0).toBe(0);
      }
    }
  });

  test("no zones means no clinics, never every clinic", async () => {
    // The `IN ()` widening trap: an empty list must match nothing. Read as
    // "unrestricted" it would hand a manager with no ground the whole country.
    const metrics = await team.findMemberMetrics({
      verticalId: 1,
      userIds: [4, 5, 6],
      scope: "rep",
      withinZoneIds: [],
      ordersFrom: monthAgo,
      ordersTo: now,
    });

    expect(metrics.size).toBe(0);
  });

  test("the profile carries who someone is, not what they measure", async () => {
    const zones = await directory.findManagerZoneIds({ userId: 541, verticalId: 1 });
    const reps = await team.listRepsUnderZones({ verticalId: 1, zoneIds: zones });
    if (reps.length === 0) return;

    for (const rep of reps) {
      const profile = await team.findMember({
        userId: rep.userId,
        verticalId: 1,
        withinZoneIds: zones,
      });

      expect(profile!.email).toBe(rep.email);
      expect(profile!.outOfTerritoryCount).toBeGreaterThanOrEqual(0);
      // Excluded on purpose (0015 §4.1) — a profile is not a personnel file.
      expect(profile).not.toHaveProperty("birthDate");
      expect(Number.isNaN(Date.parse(profile!.memberSince))).toBe(false);
      // The counts come from the metric use cases, which own their definition.
      // Recomputing them here is what produced two spellings of one number.
      expect(profile).not.toHaveProperty("assignedClinicCount");
      expect(profile).not.toHaveProperty("unassignedClinicCount");
    }
  });

  test("a profile names no territory the reader cannot reach", async () => {
    const zones = await directory.findManagerZoneIds({ userId: 541, verticalId: 1 });
    const reps = await team.listRepsUnderZones({ verticalId: 1, zoneIds: zones });
    if (reps.length === 0) return;

    const foreign = await team.findMember({
      userId: reps[0]!.userId,
      verticalId: 1,
      // Ground this rep does not work: their patches must not be listed.
      withinZoneIds: [-1],
    });

    expect(foreign!.territories).toEqual([]);
  });

  test("the roster's batch agrees with the card's own definition", async () => {
    // The roster batches four metrics into one statement because computing them
    // per member was an N+1. That is a second implementation of a number the
    // Desempenho cards already define, so the two have to be pinned together —
    // this test is the pin, and it is the reason the duplication is acceptable.
    const zones = await directory.findManagerZoneIds({ userId: 541, verticalId: 1 });
    const reps = await team.listRepsUnderZones({ verticalId: 1, zoneIds: zones });
    if (reps.length === 0) return;

    const batched = await team.findMemberMetrics({
      verticalId: 1,
      userIds: reps.map((r) => r.userId),
      scope: "rep",
      withinZoneIds: zones,
      ordersFrom: monthAgo,
      ordersTo: now,
    });

    for (const rep of reps) {
      const canonical = await repository.countProfiles(
        filter({ repUserIds: [rep.userId], zoneIds: zones }),
      );
      expect(batched.get(rep.userId)!.assignedClinics).toBe(canonical);
    }
  });

  test("the patch door offers only free clinics the rep covers (0015 R6)", async () => {
    const zones = await directory.findManagerZoneIds({ userId: 541, verticalId: 1 });
    const reps = await team.listRepsUnderZones({ verticalId: 1, zoneIds: zones });
    if (reps.length === 0) return;

    const page = await team.listAssignableClinics({
      userId: reps[0]!.userId,
      verticalId: 1,
      mode: "patch",
      withinZoneIds: zones,
      offset: 0,
      limit: 25,
    });

    for (const row of page.rows) {
      // Inside their patch, so I2 is satisfied by geometry and no reason is
      // needed. If this were ever true here the screen would demand a sentence
      // for a clinic the rep already covers.
      expect(row.requiresReason).toBe(false);
      // Free: the patch door exists to fill gaps, not to take from colleagues.
      expect(row.currentRepId).toBeNull();
      expect(row.name.length).toBeGreaterThan(0);
    }
  });

  test("the search door reaches beyond the patch, and says a reason is due", async () => {
    const zones = await directory.findManagerZoneIds({ userId: 541, verticalId: 1 });
    const reps = await team.listRepsUnderZones({ verticalId: 1, zoneIds: zones });
    if (reps.length === 0) return;

    const inPatch = await team.listAssignableClinics({
      userId: reps[0]!.userId,
      verticalId: 1,
      mode: "patch",
      withinZoneIds: zones,
      offset: 0,
      limit: 25,
    });
    const anywhere = await team.listAssignableClinics({
      userId: reps[0]!.userId,
      verticalId: 1,
      mode: "search",
      withinZoneIds: zones,
      offset: 0,
      limit: 25,
    });

    // Searching cannot offer less than the patch does, or the second door
    // would be a narrower version of the first rather than a wider one.
    expect(anywhere.total).toBeGreaterThanOrEqual(inPatch.total);

    // Spec 0009 R2: outside the patch, I2 needs an override instead of
    // geometry — and the client cannot work that out, so the server says so.
    const outside = anywhere.rows.filter((row) => row.requiresReason);
    if (inPatch.total < anywhere.total) {
      expect(outside.length).toBeGreaterThan(0);
    }
  });

  test("a rep with no patch is offered nothing to take without a reason", async () => {
    // ST_Union over no rows is NULL, and `ST_Covers(NULL, point)` is NULL —
    // which a WHERE clause drops. Worth pinning: the alternative reading of an
    // empty patch set is "covers everything".
    const orphans = await team.listRepsWithoutPatch();
    if (orphans.length === 0) return;

    const page = await team.listAssignableClinics({
      userId: orphans[0]!.userId,
      verticalId: 1,
      mode: "patch",
      withinZoneIds: null,
      offset: 0,
      limit: 25,
    });

    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
  });

  test("no zones means nothing to assign from", async () => {
    const page = await team.listAssignableClinics({
      userId: 5,
      verticalId: 1,
      mode: "patch",
      withinZoneIds: [],
      offset: 0,
      limit: 25,
    });

    expect(page.total).toBe(0);
  });

  test("a manager is measured on their zones, not on assignments", async () => {
    const managers = await team.listManagers(1);
    if (managers.length === 0) return;

    const metrics = await team.findMemberMetrics({
      verticalId: 1,
      userIds: managers.map((m) => m.userId),
      scope: "manager",
      ordersFrom: monthAgo,
      ordersTo: now,
    });

    for (const manager of managers) {
      const row = metrics.get(manager.userId);
      if (row == null) continue;
      // A manager holds no clinics directly — the roster says 0 — so a zone
      // denominator is the only thing that gives them a number at all.
      expect(manager.assignedClinicCount).toBe(0);
      expect(row.assignedClinics).toBeGreaterThan(0);
    }
  });
});

describe.skipIf(!dbUp)("pending invites (spec 0015 R11)", () => {
  test("the query runs and offers only live invitations", async () => {
    // There are no invitations in this snapshot, so this proves the statement
    // is executable and its predicates parse — not that it finds anything.
    // What it cannot prove is checked by the use-case tests instead.
    const zones = await directory.findManagerZoneIds({ userId: 541, verticalId: 1 });
    const rows = await team.listPendingInvites({ verticalId: 1, zoneIds: zones });

    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) {
      // Only PENDING and unexpired: a revoked or lapsed invitation is not
      // somebody arriving, and listing it would make the roster a list of
      // intentions rather than of people.
      expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now());
      expect(row.territories.length).toBeGreaterThan(0);
    }
  });

  test("no zones means no invites, never every invite", async () => {
    expect(
      await team.listPendingInvites({ verticalId: 1, zoneIds: [] }),
    ).toEqual([]);
  });
});
