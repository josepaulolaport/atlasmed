import { describe, expect, test } from "bun:test";
import {
  facilities,
  municipalities,
  personFacilities,
  persons,
  states,
  users,
  roles,
} from "@atlasmed/database";
import { sql } from "drizzle-orm";
import {
  isDatabaseReachable,
  uniqueAbbreviation,
  withRollback,
  type Tx,
} from "../../../../../test-utils/db-harness";
import { DrizzleFacilityBookmarkRepository } from "./drizzle-facility-bookmark.repository";
import { DrizzlePersonBookmarkRepository } from "../../../../person/infrastructure/repositories/drizzle/drizzle-person-bookmark.repository";
import type { ScopeContext } from "@atlasmed/access";

/**
 * These repositories carry the two rules a fake cannot check.
 *
 * 1. The toggle is idempotent only because a UNIQUE index exists. Asserting
 *    that against a fake asserts the fake.
 * 2. Scope filtering decides whether one rep can see another rep's clinic.
 *    Getting it wrong is a data leak, and the failure is invisible — the
 *    endpoint returns 200 with one row too many.
 */
const dbUp = await isDatabaseReachable();

function scope(facilityIds: number[], isGlobal = false): ScopeContext {
  return {
    isGlobal,
    assignedTerritoryIds: [],
    effectiveTerritoryIds: [],
    analyticsEffectiveTerritoryIds: [],
    territoryIds: [],
    facilityIds,
    analyticsFacilityIds: facilityIds,
    clinicIds: facilityIds,
    analyticsClinicIds: facilityIds,
    managedUserIds: [],
    isOperationallyActive: true,
  };
}

async function seedUser(tx: Tx): Promise<number> {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const [existingRole] = await tx.select({ id: roles.id }).from(roles).limit(1);
  const role =
    existingRole ??
    (await tx.insert(roles).values({ name: `T-Role-${suffix}` }).returning({ id: roles.id }))[0];
  const [user] = await tx
    .insert(users)
    .values({
      username: `t-user-${suffix}`,
      email: `t-user-${suffix}@example.test`,
      passwordHash: "x",
      roleId: role!.id,
    })
    .returning({ id: users.id });
  return user!.id;
}

async function seedFacility(tx: Tx, opts: { deactivated?: boolean } = {}): Promise<number> {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const [state] = await tx
    .insert(states)
    .values({
      name: `T-State-${suffix}`,
      ibgeId: `T${suffix}`.slice(0, 12),
      abbreviation: uniqueAbbreviation(),
    })
    .returning({ id: states.id });
  const [municipality] = await tx
    .insert(municipalities)
    .values({ stateId: state!.id, name: `T-City-${suffix}`, ibgeId: `M${suffix}`.slice(0, 12) })
    .returning({ id: municipalities.id });
  const [facility] = await tx
    .insert(facilities)
    .values({
      // Spec 0015: every facility carries the CNES establishment it came from,
      // and `cnes_code` is UNIQUE — so it must differ per seeded row.
      cnesCode: crypto.randomUUID(),
      displayName: `T-Facility-${suffix}`,
      legalDocumentType: "CNPJ",
      stateId: state!.id,
      municipalityId: municipality!.id,
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
      deactivatedAt: opts.deactivated ? new Date() : null,
    })
    .returning({ id: facilities.id });
  return facility!.id;
}

async function seedPerson(tx: Tx, opts: { deleted?: boolean } = {}): Promise<number> {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const [person] = await tx
    .insert(persons)
    .values({
      firstName: `T-${suffix}`.slice(0, 20),
      lastName: "Doctor",
      deletedAt: opts.deleted ? new Date() : null,
    })
    .returning({ id: persons.id });
  return person!.id;
}

describe.if(dbUp)("facility bookmarks (database)", () => {
  const repo = new DrizzleFacilityBookmarkRepository();

  test("adding twice leaves one row", async () => {
    await withRollback(async (tx) => {
      const userId = await seedUser(tx);
      const facilityId = await seedFacility(tx);

      await repo.add({ userId, facilityId }, tx);
      await repo.add({ userId, facilityId }, tx);

      // The unique index is the guarantee, not a prior read — a retried request
      // on a flaky connection must not double-insert.
      const page = await repo.listForUser(
        { userId, scope: scope([facilityId]), page: 1, limit: 20 },
        tx
      );
      expect(page.total).toBe(1);
      expect(page.items).toHaveLength(1);
    });
  });

  test("removing is idempotent", async () => {
    await withRollback(async (tx) => {
      const userId = await seedUser(tx);
      const facilityId = await seedFacility(tx);

      await repo.add({ userId, facilityId }, tx);
      await repo.remove({ userId, facilityId }, tx);
      await repo.remove({ userId, facilityId }, tx);

      const page = await repo.listForUser(
        { userId, scope: scope([facilityId]), page: 1, limit: 20 },
        tx
      );
      expect(page.total).toBe(0);
    });
  });

  test("a clinic outside scope disappears but the row survives", async () => {
    await withRollback(async (tx) => {
      const userId = await seedUser(tx);
      const facilityId = await seedFacility(tx);
      await repo.add({ userId, facilityId }, tx);

      // Territory changed: the clinic is no longer visible to this rep.
      const gone = await repo.listForUser(
        { userId, scope: scope([]), page: 1, limit: 20 },
        tx
      );
      expect(gone.total).toBe(0);

      // Territory changed back — their curation returns, because we filter on
      // read rather than deleting the row.
      const back = await repo.listForUser(
        { userId, scope: scope([facilityId]), page: 1, limit: 20 },
        tx
      );
      expect(back.total).toBe(1);
    });
  });

  test("a deactivated clinic never resurfaces, even in scope", async () => {
    await withRollback(async (tx) => {
      const userId = await seedUser(tx);
      const facilityId = await seedFacility(tx, { deactivated: true });
      await repo.add({ userId, facilityId }, tx);

      // ON DELETE CASCADE cannot cover this: deactivation is a soft delete.
      const page = await repo.listForUser(
        { userId, scope: scope([facilityId]), page: 1, limit: 20 },
        tx
      );
      expect(page.total).toBe(0);
    });
  });

  test("a global scope sees its own bookmarks without a facility filter", async () => {
    await withRollback(async (tx) => {
      const userId = await seedUser(tx);
      const facilityId = await seedFacility(tx);
      await repo.add({ userId, facilityId }, tx);

      const page = await repo.listForUser(
        { userId, scope: scope([], true), page: 1, limit: 20 },
        tx
      );
      expect(page.total).toBe(1);
    });
  });

  test("one user's bookmarks are invisible to another", async () => {
    await withRollback(async (tx) => {
      const [a, b] = [await seedUser(tx), await seedUser(tx)];
      const facilityId = await seedFacility(tx);
      await repo.add({ userId: a, facilityId }, tx);

      const other = await repo.listForUser(
        { userId: b, scope: scope([facilityId]), page: 1, limit: 20 },
        tx
      );
      expect(other.total).toBe(0);
      expect(await repo.findBookmarkedIds({ userId: b, facilityIds: [facilityId] }, tx)).toEqual([]);
      expect(await repo.findBookmarkedIds({ userId: a, facilityIds: [facilityId] }, tx)).toEqual([facilityId]);
    });
  });
});

describe.if(dbUp)("doctor bookmarks (database)", () => {
  const repo = new DrizzlePersonBookmarkRepository();

  test("a doctor in two in-scope clinics is returned once", async () => {
    await withRollback(async (tx) => {
      const userId = await seedUser(tx);
      const personId = await seedPerson(tx);
      const clinicA = await seedFacility(tx);
      const clinicB = await seedFacility(tx);
      await tx.insert(personFacilities).values([
        { personId, facilityId: clinicA },
        { personId, facilityId: clinicB },
      ]);
      await repo.add({ userId, personId }, tx);

      // A join here would return the doctor once per clinic and report total 2.
      const page = await repo.listForUser(
        { userId, scope: scope([clinicA, clinicB]), page: 1, limit: 20 },
        tx
      );
      expect(page.total).toBe(1);
      expect(page.items).toHaveLength(1);
    });
  });

  test("a doctor stays visible while any of their clinics is in scope", async () => {
    await withRollback(async (tx) => {
      const userId = await seedUser(tx);
      const personId = await seedPerson(tx);
      const mine = await seedFacility(tx);
      const theirs = await seedFacility(tx);
      await tx.insert(personFacilities).values([
        { personId, facilityId: mine },
        { personId, facilityId: theirs },
      ]);
      await repo.add({ userId, personId }, tx);

      expect(
        (await repo.listForUser({ userId, scope: scope([mine]), page: 1, limit: 20 }, tx)).total
      ).toBe(1);

      // Last clinic left scope — the doctor drops out.
      expect(
        (await repo.listForUser({ userId, scope: scope([]), page: 1, limit: 20 }, tx)).total
      ).toBe(0);
    });
  });

  test("a soft-deleted doctor never resurfaces", async () => {
    await withRollback(async (tx) => {
      const userId = await seedUser(tx);
      const personId = await seedPerson(tx, { deleted: true });
      const clinic = await seedFacility(tx);
      await tx.insert(personFacilities).values({ personId, facilityId: clinic });
      await repo.add({ userId, personId }, tx);

      const page = await repo.listForUser(
        { userId, scope: scope([clinic]), page: 1, limit: 20 },
        tx
      );
      expect(page.total).toBe(0);
    });
  });
});
