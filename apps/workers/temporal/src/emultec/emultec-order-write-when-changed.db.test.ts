import { describe, expect, test } from "bun:test";
import {
  businessVerticals,
  facilities,
  facilityVerticalProfiles,
  municipalities,
  orders,
  states,
} from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";
import {
  isDatabaseReachable,
  uniqueAbbreviation,
  withRollback,
  type Tx,
} from "../test-utils/db-harness";
import { emultecOrderRowUnchanged, type EmultecOrderRow } from "./import-emultec-orders";

/**
 * The unit tests for `emultecOrderRowUnchanged` compare values in memory. That
 * proves the predicate, not the thing it depends on: that a row written through
 * drizzle and read back compares equal to what was written.
 *
 * Two ways that silently fails, both of which would leave the importer writing
 * on every pass while every test still passed:
 *
 * - `ordered_at` is `timestamp` (no time zone) and the importer builds a UTC
 *   `Date`. If the round trip shifts it, `sameTimestamp` is false forever.
 * - `numeric` comes back at the column's scale (`"1.00"` / `"2.500"`), never as
 *   the `String(n)` that went in.
 *
 * Both need a real Postgres to observe.
 */
const dbUp = await isDatabaseReachable();

/** Exactly what `parseOrderedAt` produces for a MySQL `YYYY-MM-DD`. */
const ORDERED_AT = new Date("2026-03-04T12:00:00.000Z");

async function seedProfile(tx: Tx): Promise<number> {
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
    .values({
      stateId: state!.id,
      name: `T-City-${suffix}`,
      ibgeId: `M${suffix}`.slice(0, 12),
    })
    .returning({ id: municipalities.id });
  const [facility] = await tx
    .insert(facilities)
    .values({
      displayName: `T-Facility-${suffix}`,
      legalDocumentType: "CNPJ",
      stateId: state!.id,
      municipalityId: municipality!.id,
      location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
    })
    .returning({ id: facilities.id });
  const [vertical] = await tx
    .insert(businessVerticals)
    .values({ code: `T-${suffix}`.slice(0, 20), name: `T-Vertical-${suffix}` })
    .returning({ id: businessVerticals.id });
  const [profile] = await tx
    .insert(facilityVerticalProfiles)
    .values({ facilityId: facility!.id, verticalId: vertical!.id })
    .returning({ id: facilityVerticalProfiles.id });
  return profile!.id;
}

/**
 * `EmultecOrderRow` widens the enums to `string` and the numerics to
 * `string | null` on purpose — the pure comparison should not depend on the
 * schema. Narrow them back at the insert boundary.
 */
async function insertOrder(
  tx: Tx,
  idAvulsaEmultec: number,
  row: EmultecOrderRow
): Promise<number> {
  const [inserted] = await tx
    .insert(orders)
    .values({
      idAvulsaEmultec,
      facilityVerticalProfileId: row.facilityVerticalProfileId,
      sellerId: row.sellerId,
      personId: row.personId,
      status: row.status as "INVOICED",
      type: row.type as "SALE",
      orderedAt: row.orderedAt,
      notes: row.notes,
      freight: row.freight ?? undefined,
      grossWeight: row.grossWeight ?? undefined,
      netWeight: row.netWeight ?? undefined,
    })
    .returning({ id: orders.id });
  return inserted!.id;
}

async function readOrder(tx: Tx, id: number): Promise<EmultecOrderRow> {
  const [row] = await tx
    .select({
      facilityVerticalProfileId: orders.facilityVerticalProfileId,
      sellerId: orders.sellerId,
      personId: orders.personId,
      status: orders.status,
      type: orders.type,
      orderedAt: orders.orderedAt,
      notes: orders.notes,
      freight: orders.freight,
      grossWeight: orders.grossWeight,
      netWeight: orders.netWeight,
    })
    .from(orders)
    .where(eq(orders.id, id));
  return row!;
}

describe.if(dbUp)("write-only-when-changed, against real Postgres", () => {
  test("a row written and read back compares as unchanged", async () => {
    await withRollback(async (tx) => {
      const profileId = await seedProfile(tx);

      // The values the importer builds from an Emultec bundle, verbatim —
      // integers stringified, not pre-scaled.
      const desired: EmultecOrderRow = {
        facilityVerticalProfileId: profileId,
        sellerId: null,
        personId: null,
        status: "INVOICED",
        type: "SALE",
        orderedAt: ORDERED_AT,
        notes: null,
        freight: String(1),
        grossWeight: String(2.5),
        netWeight: String(0),
      };

      const orderId = await insertOrder(tx, 987_654_321, desired);
      const existing = await readOrder(tx, orderId);

      // Postgres really does hand these back rescaled — if it ever stops, the
      // assertion below is no longer testing what it thinks it is.
      expect(existing.freight).toBe("1.00");
      expect(existing.grossWeight).toBe("2.500");
      expect(existing.orderedAt.getTime()).toBe(ORDERED_AT.getTime());

      // The property that matters: a second import of an unchanged order must
      // not write. If this is false, every re-read bumps `updated_at` and
      // recalculates the clinic's purchase recurrence.
      expect(emultecOrderRowUnchanged(existing, desired)).toBe(
        true
      );
    });
  });

  test("a genuine value change is still detected after a round trip", async () => {
    await withRollback(async (tx) => {
      const profileId = await seedProfile(tx);
      const desired: EmultecOrderRow = {
        facilityVerticalProfileId: profileId,
        sellerId: null,
        personId: null,
        status: "INVOICED",
        type: "SALE",
        orderedAt: ORDERED_AT,
        notes: null,
        freight: String(1),
        grossWeight: String(2.5),
        netWeight: String(0),
      };

      const orderId = await insertOrder(tx, 987_654_322, desired);
      const existing = await readOrder(tx, orderId);

      // Emultec restated the order as a donation — must not be swallowed.
      expect(
        emultecOrderRowUnchanged(existing, {
          ...desired,
          type: "DONATION",
        })
      ).toBe(false);
      // A real freight change, not a scale artefact.
      expect(
        emultecOrderRowUnchanged(existing, {
          ...desired,
          freight: String(2),
        })
      ).toBe(false);
    });
  });
});
