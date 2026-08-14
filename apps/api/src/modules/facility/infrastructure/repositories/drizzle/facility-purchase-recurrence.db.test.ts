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
import { isDatabaseReachable, withRollback } from "../../../../../test-utils/db-harness";
import { DrizzleFacilityPurchaseRecurrenceRepository } from "./facility-purchase-recurrence.repository";

/**
 * The funnel, against a real Postgres.
 *
 * Spec 0010 §4 re-keyed orders from (facility_id, vertical_id) onto
 * facility_vertical_profile_id, and the funnel is the most dangerous consumer:
 * `purchase_funnel_stage` is written back onto the profile, so if the order set
 * changes, clinics silently re-stage and nothing errors.
 *
 * Every other test around this change asserts against fake repositories, which
 * can only prove query *shape*. This one inserts real rows and reads them back
 * through the production repository, so it proves the column exists, the join is
 * right, and — the point — that one profile's funnel cannot see another
 * profile's orders.
 *
 * Runs inside a transaction that is always rolled back, so it seeds freely and
 * leaves nothing behind. Skips without a reachable database; CI always has one.
 */
const dbUp = await isDatabaseReachable();

describe.skipIf(!dbUp)("funnel purchase dates (database)", () => {
  test("a profile's purchase dates exclude another vertical's orders", async () => {
    await withRollback(async (tx) => {
      const [orto] = await tx
        .insert(businessVerticals)
        .values({ code: "T-ORTO", name: "T-ORTO" })
        .returning({ id: businessVerticals.id });
      const [derma] = await tx
        .insert(businessVerticals)
        .values({ code: "T-DERMA", name: "T-DERMA" })
        .returning({ id: businessVerticals.id });

      // Derived, not literal: `states.ibge_id` and `abbreviation` are UNIQUE, and
      // the CNES loader's test commits a permanent `99` / `ZZ` state into the same
      // database instead of rolling back. The literals here collided with it.
      const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const [state] = await tx
        .insert(states)
        .values({
          name: `T-State-${suffix}`,
          ibgeId: `T${suffix}`.slice(0, 12),
          abbreviation: suffix.slice(0, 2).toUpperCase(),
        })
        .returning({ id: states.id });
      const [municipality] = await tx
        .insert(municipalities)
        .values({
          stateId: state!.id,
          name: "T-City",
          ibgeId: `T${suffix}`.slice(0, 12),
        })
        .returning({ id: municipalities.id });

      const [facility] = await tx
        .insert(facilities)
        .values({
          displayName: "CLINICA TESTE",
          legalDocumentType: "CNPJ",
          stateId: state!.id,
          municipalityId: municipality!.id,
          // Spec 0009 R5: every clinic has a position.
          location: sql`ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)`,
        })
        .returning({ id: facilities.id });

      const [ortoProfile] = await tx
        .insert(facilityVerticalProfiles)
        .values({ facilityId: facility!.id, verticalId: orto!.id })
        .returning({ id: facilityVerticalProfiles.id });
      const [dermaProfile] = await tx
        .insert(facilityVerticalProfiles)
        .values({ facilityId: facility!.id, verticalId: derma!.id })
        .returning({ id: facilityVerticalProfiles.id });

      // One eligible order per profile, on different dates. Same facility — which
      // is exactly the case the old (facility, vertical) keying got wrong when the
      // vertical was forgotten.
      await tx.insert(orders).values([
        {
          facilityVerticalProfileId: ortoProfile!.id,
          status: "APPROVED",
          type: "SALE",
          orderedAt: new Date("2026-03-10T12:00:00.000Z"),
        },
        {
          facilityVerticalProfileId: dermaProfile!.id,
          status: "APPROVED",
          type: "SALE",
          orderedAt: new Date("2026-04-20T12:00:00.000Z"),
        },
        // Ineligible: right profile, wrong status. Guards the predicate itself,
        // which must stay identical to orders_valid_purchase_profile_ordered_at_idx.
        {
          facilityVerticalProfileId: ortoProfile!.id,
          status: "DRAFT",
          type: "SALE",
          orderedAt: new Date("2026-05-01T12:00:00.000Z"),
        },
      ]);

      const repository = new DrizzleFacilityPurchaseRecurrenceRepository(
        tx as unknown as ConstructorParameters<
          typeof DrizzleFacilityPurchaseRecurrenceRepository
        >[0],
      );

      let ortoDates: string[] = [];
      await repository.withLockedProfile(facility!.id, orto!.id, async ({ purchaseDates }) => {
        ortoDates = purchaseDates;
        return {
          snapshot: {
            observedPurchaseIntervalDays: null,
            purchaseIntervalDays: 30,
            purchaseIntervalSource: "DEFAULT",
            lastValidPurchaseDate: null,
            purchaseRecurrenceSampleSize: 0,
            purchaseFunnelStage: "NEVER_PURCHASED",
            nextPurchaseFunnelTransitionDate: null,
          },
          configuration: { manualProfile: null, manualIntervalDays: null },
        } as never;
      });

      // Ortopedia sees only its own APPROVED order — not Dermatologia's, and not
      // its own DRAFT.
      expect(ortoDates).toEqual(["2026-03-10"]);
    });
  });
});
