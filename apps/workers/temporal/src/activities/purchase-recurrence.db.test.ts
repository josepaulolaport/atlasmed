import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  facilities,
  facilityVerticalProfiles,
  municipalities,
  orders,
  states,
} from "@atlasmed/database";
import { sql } from "drizzle-orm";
import { isDatabaseReachable, withRollback, type Tx } from "../test-utils/db-harness";
import { DrizzlePurchaseRecurrenceStore } from "./purchase-recurrence.activities";

/**
 * Reconcile page selection, against a real Postgres.
 *
 * `listChangedOrderFacilityIds` was hand-written SQL joining `orders.facility_id`,
 * a column spec 0010 §4 removed when orders were re-keyed onto
 * `facility_vertical_profile_id`. The unit tests mock the store, so the query was
 * never executed by anything: the hourly reconcile schedule and the child
 * workflow the Emultec importer starts both failed with 42703 on every run, and
 * the funnel refreshed only on the midnight full sweep.
 *
 * Query shape cannot be asserted against a fake. This inserts real rows and reads
 * them back through the production store, so it proves the column exists, the
 * facility is reached through the profile, and that the window and cursor still
 * bound the page.
 *
 * Runs inside a transaction that is always rolled back. Skips without a reachable
 * database; CI always has one.
 */
const dbUp = await isDatabaseReachable();

const INSIDE_WINDOW = new Date("2026-05-10T12:00:00.000Z");
const BEFORE_WINDOW = new Date("2026-05-01T12:00:00.000Z");
const SINCE = "2026-05-05T00:00:00.000Z";
const UNTIL = "2026-05-15T00:00:00.000Z";

interface Seeded {
  changedFacilityId: number;
  untouchedFacilityId: number;
  deactivatedFacilityId: number;
}

async function seed(tx: Tx): Promise<Seeded> {
  const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;

  const [vertical] = await tx
    .insert(businessVerticals)
    .values({ code: `T-RECONCILE-${suffix}`, name: "T-RECONCILE" })
    .returning({ id: businessVerticals.id });
  const [state] = await tx
    .insert(states)
    .values({ name: `T-State-${suffix}`, ibgeId: "98", abbreviation: "ZZ" })
    .returning({ id: states.id });
  const [municipality] = await tx
    .insert(municipalities)
    .values({ stateId: state!.id, name: "T-City", ibgeId: "9899999" })
    .returning({ id: municipalities.id });

  async function facility(input: { deactivated: boolean }): Promise<number> {
    const [row] = await tx
      .insert(facilities)
      .values({
        displayName: "CLINICA TESTE",
        legalDocumentType: "CNPJ",
        stateId: state!.id,
        municipalityId: municipality!.id,
        // Spec 0009 R5: every clinic has a position.
        location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
        deactivatedAt: input.deactivated ? new Date() : null,
      })
      .returning({ id: facilities.id });
    return row!.id;
  }

  async function orderOn(facilityId: number, updatedAt: Date): Promise<void> {
    const [profile] = await tx
      .insert(facilityVerticalProfiles)
      .values({ facilityId, verticalId: vertical!.id })
      .returning({ id: facilityVerticalProfiles.id });
    await tx.insert(orders).values({
      facilityVerticalProfileId: profile!.id,
      status: "INVOICED",
      type: "SALE",
      orderedAt: updatedAt,
      // $onUpdate only fires on update; the window predicate reads this column.
      updatedAt,
    });
  }

  const changedFacilityId = await facility({ deactivated: false });
  const untouchedFacilityId = await facility({ deactivated: false });
  const deactivatedFacilityId = await facility({ deactivated: true });

  await orderOn(changedFacilityId, INSIDE_WINDOW);
  await orderOn(untouchedFacilityId, BEFORE_WINDOW);
  await orderOn(deactivatedFacilityId, INSIDE_WINDOW);

  return { changedFacilityId, untouchedFacilityId, deactivatedFacilityId };
}

function storeOn(tx: Tx): DrizzlePurchaseRecurrenceStore {
  return new DrizzlePurchaseRecurrenceStore(
    tx as unknown as ConstructorParameters<typeof DrizzlePurchaseRecurrenceStore>[0],
  );
}

describe.skipIf(!dbUp)("reconcile page selection (database)", () => {
  test("returns facilities whose orders changed inside the window", async () => {
    await withRollback(async (tx) => {
      const seeded = await seed(tx);

      const ids = await storeOn(tx).listChangedOrderFacilityIds({
        cursor: null,
        limit: 500,
        since: SINCE,
        until: UNTIL,
      });

      expect(ids).toContain(seeded.changedFacilityId);
      // Order updated before `since` — outside the window.
      expect(ids).not.toContain(seeded.untouchedFacilityId);
      // Deactivated clinics are not restaged.
      expect(ids).not.toContain(seeded.deactivatedFacilityId);
    });
  });

  test("the cursor excludes facilities at or below it", async () => {
    await withRollback(async (tx) => {
      const seeded = await seed(tx);

      const ids = await storeOn(tx).listChangedOrderFacilityIds({
        cursor: seeded.changedFacilityId,
        limit: 500,
        since: SINCE,
        until: UNTIL,
      });

      expect(ids).not.toContain(seeded.changedFacilityId);
    });
  });
});
