import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  clinicalFocuses,
  facilities,
  facilityClinicalFocuses,
  facilityVerticalProfiles,
  municipalities,
  orders,
  purchaseRecurrenceWatermark,
  states,
} from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";
import {
  isDatabaseReachable,
  uniqueAbbreviation,
  withRollback,
  type Tx,
} from "../test-utils/db-harness";
import { DrizzlePurchaseRecurrenceStore } from "./purchase-recurrence.activities";

/**
 * `recalculateFacilities`, against a real Postgres.
 *
 * The two things it does that a fake cannot check are both query shape. The
 * purchase-date read is a window function over a distinct-day subquery — one
 * statement for a whole page, where it used to be one per profile — and the
 * document is built from a column list shared with the full rebuild. The
 * previous version of this activity omitted two of those columns and, because
 * publication replaces the document rather than merging into it, blanked them on
 * every facility it touched. Nothing errored and no unit test noticed, which is
 * the same way `listChangedOrderFacilityIds` shipped a column that did not
 * exist.
 *
 * Runs inside a transaction that is always rolled back. Skips without a
 * reachable database; CI always has one.
 */
const dbUp = await isDatabaseReachable();

const TODAY = "2026-08-15";

interface Fixture {
  facilityId: number;
  profileId: number;
  clinicalFocusId: number;
  unitTypeId: number | null;
}

async function seed(
  tx: Tx,
  input: { orderedAt: Date[]; deactivated?: boolean } = { orderedAt: [] },
): Promise<Fixture> {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;

  const [vertical] = await tx
    .insert(businessVerticals)
    .values({ code: `T-RECALC-${suffix}`, name: "T-RECALC" })
    .returning({ id: businessVerticals.id });
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
    .values({ stateId: state!.id, name: "T-City", ibgeId: `T${suffix}`.slice(0, 12) })
    .returning({ id: municipalities.id });
  const [focus] = await tx
    .insert(clinicalFocuses)
    .values({ name: `T-Focus-${suffix}` })
    .returning({ id: clinicalFocuses.id });

  const [facility] = await tx
    .insert(facilities)
    .values({
      displayName: "CLINICA TESTE",
      legalDocumentType: "CNPJ",
      // Spec 0015: every facility names a CNES establishment, uniquely.
      cnesCode: crypto.randomUUID(),
      stateId: state!.id,
      municipalityId: municipality!.id,
      // Spec 0009 R5: every clinic has a position.
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
      deactivatedAt: input.deactivated ? new Date() : null,
    })
    .returning({ id: facilities.id, unitTypeId: facilities.unitTypeId });

  await tx.insert(facilityClinicalFocuses).values({
    facilityId: facility!.id,
    clinicalFocusId: focus!.id,
  });

  const [profile] = await tx
    .insert(facilityVerticalProfiles)
    .values({ facilityId: facility!.id, verticalId: vertical!.id })
    .returning({ id: facilityVerticalProfiles.id });

  for (const orderedAt of input.orderedAt) {
    await tx.insert(orders).values({
      facilityVerticalProfileId: profile!.id,
      status: "INVOICED",
      type: "SALE",
      orderedAt,
    });
  }

  return {
    facilityId: facility!.id,
    profileId: profile!.id,
    clinicalFocusId: focus!.id,
    unitTypeId: facility!.unitTypeId,
  };
}

function storeOn(tx: Tx): DrizzlePurchaseRecurrenceStore {
  return new DrizzlePurchaseRecurrenceStore(
    tx as unknown as ConstructorParameters<typeof DrizzlePurchaseRecurrenceStore>[0],
  );
}

/** `days` calendar days before 2026-08-15, at midday São Paulo. */
function daysAgo(days: number): Date {
  return new Date(Date.UTC(2026, 7, 15 - days, 15, 0, 0));
}

describe.skipIf(!dbUp)("purchase recurrence recalculation (database)", () => {
  test("writes the snapshot and keeps every indexed facility column", async () => {
    await withRollback(async (tx) => {
      const fixture = await seed(tx, { orderedAt: [daysAgo(40), daysAgo(20), daysAgo(0)] });

      const [result] = await storeOn(tx).recalculateFacilities([fixture.facilityId], TODAY);

      expect(result).toMatchObject({ facilityId: fixture.facilityId, changed: true });

      const [profile] = await tx
        .select()
        .from(facilityVerticalProfiles)
        .where(eq(facilityVerticalProfiles.id, fixture.profileId));
      expect(profile).toMatchObject({
        // Gaps of 20 and 20 days.
        observedPurchaseIntervalDays: 20,
        purchaseIntervalDays: 20,
        purchaseIntervalSource: "CALCULATED",
        purchaseRecurrenceSampleSize: 2,
        purchaseFunnelStage: "OUTSIDE_WINDOW",
      });
      expect(profile!.purchaseRecurrenceCalculatedAt).not.toBeNull();

      /**
       * The wipe this activity used to cause. `legalDocumentType`, `unitTypeId`
       * and `clinicalFocusIds` are filterable attributes, and publication
       * replaces the document — a missing key here removes the clinic from those
       * filters until the next full rebuild, with nothing raising an error.
       */
      expect(result!.document).toMatchObject({
        id: String(fixture.facilityId),
        legalDocumentType: "CNPJ",
        unitTypeId: fixture.unitTypeId,
        clinicalFocusIds: [fixture.clinicalFocusId],
      });
      expect(result!.document).toHaveProperty("cnesCode");
      expect(result!.document?._geo).toMatchObject({ lat: -23.5, lng: -46.6 });
    });
  });

  test("counts an order by its São Paulo day, not its UTC day", async () => {
    await withRollback(async (tx) => {
      // 22:30 on the 14th in São Paulo, which is already the 15th in UTC.
      const fixture = await seed(tx, {
        orderedAt: [new Date("2026-08-15T01:30:00.000Z")],
      });

      await storeOn(tx).recalculateFacilities([fixture.facilityId], TODAY);

      const [profile] = await tx
        .select({ lastValidPurchaseDate: facilityVerticalProfiles.lastValidPurchaseDate })
        .from(facilityVerticalProfiles)
        .where(eq(facilityVerticalProfiles.id, fixture.profileId));
      expect(String(profile!.lastValidPurchaseDate).slice(0, 10)).toBe("2026-08-14");
    });
  });

  test("takes thirteen distinct days at most and folds same-day orders into one", async () => {
    await withRollback(async (tx) => {
      // Twenty distinct days, ten days apart, plus a duplicate on the newest.
      const orderedAt = Array.from({ length: 20 }, (_, index) => daysAgo(index * 10));
      orderedAt.push(new Date(Date.UTC(2026, 7, 15, 20, 0, 0)));

      const fixture = await seed(tx, { orderedAt });
      await storeOn(tx).recalculateFacilities([fixture.facilityId], TODAY);

      const [profile] = await tx
        .select()
        .from(facilityVerticalProfiles)
        .where(eq(facilityVerticalProfiles.id, fixture.profileId));
      // Thirteen days produce twelve gaps, and the two orders on the newest day
      // are one purchase occasion.
      expect(profile).toMatchObject({
        purchaseRecurrenceSampleSize: 12,
        observedPurchaseIntervalDays: 10,
      });
      expect(String(profile!.lastValidPurchaseDate).slice(0, 10)).toBe("2026-08-15");
    });
  });

  test("keeps each facility's orders to itself across a page", async () => {
    await withRollback(async (tx) => {
      const weekly = await seed(tx, {
        orderedAt: [daysAgo(14), daysAgo(7), daysAgo(0)],
      });
      const quarterly = await seed(tx, {
        orderedAt: [daysAgo(180), daysAgo(90), daysAgo(0)],
      });

      const results = await storeOn(tx).recalculateFacilities(
        [weekly.facilityId, quarterly.facilityId],
        TODAY,
      );

      expect(results.map((result) => result.facilityId)).toEqual([
        weekly.facilityId,
        quarterly.facilityId,
      ]);

      const intervals = await tx
        .select({
          id: facilityVerticalProfiles.id,
          days: facilityVerticalProfiles.observedPurchaseIntervalDays,
        })
        .from(facilityVerticalProfiles);
      const byProfile = new Map(intervals.map((row) => [row.id, row.days]));
      expect(byProfile.get(weekly.profileId)).toBe(7);
      expect(byProfile.get(quarterly.profileId)).toBe(90);
    });
  });

  test("is a no-op on the second pass over unchanged orders", async () => {
    await withRollback(async (tx) => {
      const fixture = await seed(tx, { orderedAt: [daysAgo(20), daysAgo(0)] });
      const store = storeOn(tx);

      const [first] = await store.recalculateFacilities([fixture.facilityId], TODAY);
      const [second] = await store.recalculateFacilities([fixture.facilityId], TODAY);

      expect(first!.changed).toBe(true);
      // The document is still published on a no-op: a prior commit may have
      // outlived a failed search update.
      expect(second!.changed).toBe(false);
      expect(second!.document).not.toBeNull();
    });
  });

  test("returns no document for a deactivated facility so the ghost is deleted", async () => {
    await withRollback(async (tx) => {
      const fixture = await seed(tx, { orderedAt: [daysAgo(0)], deactivated: true });

      const [result] = await storeOn(tx).recalculateFacilities([fixture.facilityId], TODAY);

      expect(result).toMatchObject({
        facilityId: fixture.facilityId,
        changed: false,
        document: null,
      });
    });
  });
});

describe.skipIf(!dbUp)("reconcile watermark (database)", () => {
  test("reads back nothing before any run has completed", async () => {
    await withRollback(async (tx) => {
      await tx.delete(purchaseRecurrenceWatermark);
      expect(await storeOn(tx).readCoveredUntil()).toBeNull();
    });
  });

  test("records how far a completed run covered", async () => {
    await withRollback(async (tx) => {
      await tx.delete(purchaseRecurrenceWatermark);
      const store = storeOn(tx);

      await store.commitCoveredUntil("2026-08-15T10:00:00.000Z");

      expect(await store.readCoveredUntil()).toBe("2026-08-15T10:00:00.000Z");
    });
  });

  /**
   * The hourly reconcile and the daily sweep both commit, and the sweep can
   * finish after an hourly run that started later. Moving the watermark back
   * would make the next run re-cover ground, which is merely wasteful — but the
   * same statement running out of order is how a watermark ends up ahead of what
   * was actually covered, so it is pinned in one direction.
   */
  test("never moves backwards, whatever order the runs commit in", async () => {
    await withRollback(async (tx) => {
      await tx.delete(purchaseRecurrenceWatermark);
      const store = storeOn(tx);

      await store.commitCoveredUntil("2026-08-15T10:00:00.000Z");
      await store.commitCoveredUntil("2026-08-15T06:30:00.000Z");

      expect(await store.readCoveredUntil()).toBe("2026-08-15T10:00:00.000Z");
    });
  });
});

describe.skipIf(!dbUp)("invalidated snapshot selection (database)", () => {
  test("finds a profile that has never been calculated", async () => {
    await withRollback(async (tx) => {
      const fixture = await seed(tx, { orderedAt: [daysAgo(0)] });

      const ids = await storeOn(tx).listInvalidatedFacilityIds({ cursor: null, limit: 500 });

      expect(ids).toContain(fixture.facilityId);
    });
  });

  test("drops it again once the snapshot is written", async () => {
    await withRollback(async (tx) => {
      const fixture = await seed(tx, { orderedAt: [daysAgo(0)] });
      const store = storeOn(tx);

      await store.recalculateFacilities([fixture.facilityId], TODAY);

      const ids = await store.listInvalidatedFacilityIds({ cursor: null, limit: 500 });
      expect(ids).not.toContain(fixture.facilityId);
    });
  });

  /**
   * The clinic an order moved *away* from. Nothing joins to it through `orders`
   * any more, so this is the only selector that can reach it.
   */
  test("finds a profile whose snapshot was explicitly invalidated", async () => {
    await withRollback(async (tx) => {
      const fixture = await seed(tx, { orderedAt: [daysAgo(0)] });
      const store = storeOn(tx);
      await store.recalculateFacilities([fixture.facilityId], TODAY);

      await tx
        .update(facilityVerticalProfiles)
        .set({ purchaseRecurrenceCalculatedAt: null })
        .where(eq(facilityVerticalProfiles.id, fixture.profileId));

      expect(await store.listInvalidatedFacilityIds({ cursor: null, limit: 500 }))
        .toContain(fixture.facilityId);
    });
  });

  test("ignores deactivated facilities", async () => {
    await withRollback(async (tx) => {
      const fixture = await seed(tx, { orderedAt: [daysAgo(0)], deactivated: true });

      expect(await storeOn(tx).listInvalidatedFacilityIds({ cursor: null, limit: 500 }))
        .not.toContain(fixture.facilityId);
    });
  });
});
