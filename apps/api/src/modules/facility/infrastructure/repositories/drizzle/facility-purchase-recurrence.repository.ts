import {
  facilities,
  facilityVerticalProfiles,
  orders,
  type Database,
} from "@atlasmed/database";
import {
  calculatePurchaseRecurrenceSnapshot,
  type PurchaseRecurrenceSnapshot,
} from "@atlasmed/facility-insights";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityPurchaseRecurrenceRepository,
  ManualPurchaseConfiguration,
} from "../../../application/interfaces/facility-purchase-recurrence.repository.interface";
import type { FacilityRecord } from "../../../application/interfaces/facility.repository.interface";
import { pickFacilityFunnelRollup } from "../../../application/utils/facility-purchase-funnel-rollup.utils";
import { mapFacility } from "./drizzle-facility.repository";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function loadPurchaseDates(
  tx: Tx,
  facilityId: string,
  verticalId: string,
): Promise<string[]> {
  return tx
    .select({
      date: sql<string>`(${orders.orderedAt} at time zone 'UTC')::date`.as(
        "purchase_date",
      ),
    })
    .from(orders)
    .where(
      and(
        eq(orders.facilityId, facilityId),
        eq(orders.verticalId, verticalId),
        inArray(orders.status, ["APPROVED", "INVOICED"]),
        inArray(orders.type, ["SALE", "CONSIGNMENT"]),
      ),
    )
    .groupBy(sql`(${orders.orderedAt} at time zone 'UTC')::date`)
    .orderBy(sql`(${orders.orderedAt} at time zone 'UTC')::date desc`)
    .limit(13)
    .then((rows) => rows.map((row) => String(row.date)));
}

async function applyFacilityRollup(
  tx: Tx,
  facilityId: string,
): Promise<void> {
  const profiles = await tx
    .select({
      purchaseFunnelStage: facilityVerticalProfiles.purchaseFunnelStage,
      observedPurchaseIntervalDays:
        facilityVerticalProfiles.observedPurchaseIntervalDays,
      purchaseIntervalDays: facilityVerticalProfiles.purchaseIntervalDays,
      purchaseIntervalSource: facilityVerticalProfiles.purchaseIntervalSource,
      manualPurchaseProfile: facilityVerticalProfiles.manualPurchaseProfile,
      manualPurchaseIntervalDays:
        facilityVerticalProfiles.manualPurchaseIntervalDays,
      lastValidPurchaseDate: facilityVerticalProfiles.lastValidPurchaseDate,
      purchaseRecurrenceSampleSize:
        facilityVerticalProfiles.purchaseRecurrenceSampleSize,
      nextPurchaseFunnelTransitionDate:
        facilityVerticalProfiles.nextPurchaseFunnelTransitionDate,
    })
    .from(facilityVerticalProfiles)
    .where(
      and(
        eq(facilityVerticalProfiles.facilityId, facilityId),
        eq(facilityVerticalProfiles.isActive, true),
      ),
    );

  const rollup = pickFacilityFunnelRollup(profiles);
  if (!rollup) return;

  await tx
    .update(facilities)
    .set({
      observedPurchaseIntervalDays: rollup.observedPurchaseIntervalDays,
      purchaseIntervalDays: rollup.purchaseIntervalDays,
      purchaseIntervalSource: rollup.purchaseIntervalSource,
      manualPurchaseProfile: rollup.manualPurchaseProfile,
      manualPurchaseIntervalDays: rollup.manualPurchaseIntervalDays,
      lastValidPurchaseDate: rollup.lastValidPurchaseDate,
      purchaseRecurrenceSampleSize: rollup.purchaseRecurrenceSampleSize,
      purchaseFunnelStage: rollup.purchaseFunnelStage,
      nextPurchaseFunnelTransitionDate: rollup.nextPurchaseFunnelTransitionDate,
      purchaseRecurrenceCalculatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(facilities.id, facilityId));
}

function snapshotSet(snapshot: PurchaseRecurrenceSnapshot, configuration: ManualPurchaseConfiguration) {
  return {
    observedPurchaseIntervalDays: snapshot.observedPurchaseIntervalDays,
    purchaseIntervalDays: snapshot.purchaseIntervalDays,
    purchaseIntervalSource: snapshot.purchaseIntervalSource,
    manualPurchaseProfile: configuration.manualProfile,
    manualPurchaseIntervalDays: configuration.manualIntervalDays,
    lastValidPurchaseDate: snapshot.lastValidPurchaseDate,
    purchaseRecurrenceSampleSize: snapshot.purchaseRecurrenceSampleSize,
    purchaseFunnelStage: snapshot.purchaseFunnelStage,
    nextPurchaseFunnelTransitionDate: snapshot.nextPurchaseFunnelTransitionDate,
    purchaseRecurrenceCalculatedAt: new Date(),
    updatedAt: new Date(),
  };
}

export class DrizzleFacilityPurchaseRecurrenceRepository
  implements FacilityPurchaseRecurrenceRepository
{
  constructor(private readonly database: Database = db) {}

  async withLockedProfile<T>(
    facilityId: string,
    verticalId: string,
    callback: Parameters<FacilityPurchaseRecurrenceRepository["withLockedProfile"]>[2],
    fields: Parameters<FacilityPurchaseRecurrenceRepository["withLockedProfile"]>[3] = {},
  ): Promise<{ result: T; facility: FacilityRecord } | null> {
    return this.database.transaction(async (tx) => {
      const facilityAlive = await tx
        .select({ id: facilities.id })
        .from(facilities)
        .where(
          and(eq(facilities.id, facilityId), sql`${facilities.deactivatedAt} is null`),
        )
        .limit(1);
      if (!facilityAlive[0]) return null;

      const lockedRows = await tx.execute(sql<{
        id: string;
        manual_purchase_profile: ManualPurchaseConfiguration["manualProfile"];
        manual_purchase_interval_days: number | null;
      }>`select id, manual_purchase_profile, manual_purchase_interval_days
          from ${facilityVerticalProfiles}
          where ${facilityVerticalProfiles.facilityId} = ${facilityId}
            and ${facilityVerticalProfiles.verticalId} = ${verticalId}
            and ${facilityVerticalProfiles.isActive} = true
          for update`);
      const locked = lockedRows[0] as
        | {
            id: string;
            manual_purchase_profile: ManualPurchaseConfiguration["manualProfile"];
            manual_purchase_interval_days: number | null;
          }
        | undefined;
      if (!locked) return null;

      const purchaseDates = await loadPurchaseDates(tx, facilityId, verticalId);
      const desired = await callback({
        purchaseDates,
        configuration: {
          manualProfile: locked.manual_purchase_profile,
          manualIntervalDays: locked.manual_purchase_interval_days,
        },
        verticalId,
      });

      await tx
        .update(facilityVerticalProfiles)
        .set(snapshotSet(desired.snapshot, desired.configuration))
        .where(eq(facilityVerticalProfiles.id, locked.id));

      if (fields.name !== undefined || fields.manuallyEditedAt !== undefined) {
        await tx
          .update(facilities)
          .set({
            ...(fields.name !== undefined ? { displayName: fields.name } : {}),
            ...(fields.manuallyEditedAt !== undefined
              ? { manuallyEditedAt: fields.manuallyEditedAt }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(facilities.id, facilityId));
      }

      await applyFacilityRollup(tx, facilityId);

      const [updated] = await tx
        .select()
        .from(facilities)
        .where(eq(facilities.id, facilityId))
        .limit(1);
      if (!updated) return null;
      return { result: desired.result as T, facility: mapFacility(updated) };
    });
  }

  async recalculateAllProfiles(
    facilityId: string,
    today: string,
  ): Promise<{ changed: boolean } | null> {
    return this.database.transaction(async (tx) => {
      const facilityAlive = await tx
        .select({ id: facilities.id })
        .from(facilities)
        .where(
          and(eq(facilities.id, facilityId), sql`${facilities.deactivatedAt} is null`),
        )
        .limit(1);
      if (!facilityAlive[0]) return null;

      const profiles = await tx
        .select({
          id: facilityVerticalProfiles.id,
          verticalId: facilityVerticalProfiles.verticalId,
          manualPurchaseProfile: facilityVerticalProfiles.manualPurchaseProfile,
          manualPurchaseIntervalDays:
            facilityVerticalProfiles.manualPurchaseIntervalDays,
          purchaseFunnelStage: facilityVerticalProfiles.purchaseFunnelStage,
          purchaseIntervalDays: facilityVerticalProfiles.purchaseIntervalDays,
          purchaseIntervalSource: facilityVerticalProfiles.purchaseIntervalSource,
          observedPurchaseIntervalDays:
            facilityVerticalProfiles.observedPurchaseIntervalDays,
          lastValidPurchaseDate: facilityVerticalProfiles.lastValidPurchaseDate,
          purchaseRecurrenceSampleSize:
            facilityVerticalProfiles.purchaseRecurrenceSampleSize,
          nextPurchaseFunnelTransitionDate:
            facilityVerticalProfiles.nextPurchaseFunnelTransitionDate,
          purchaseRecurrenceCalculatedAt:
            facilityVerticalProfiles.purchaseRecurrenceCalculatedAt,
        })
        .from(facilityVerticalProfiles)
        .where(
          and(
            eq(facilityVerticalProfiles.facilityId, facilityId),
            eq(facilityVerticalProfiles.isActive, true),
          ),
        );

      if (profiles.length === 0) return { changed: false };

      let changed = false;
      for (const profile of profiles) {
        const purchaseDates = await loadPurchaseDates(
          tx,
          facilityId,
          profile.verticalId,
        );
        const configuration: ManualPurchaseConfiguration = {
          manualProfile: profile.manualPurchaseProfile,
          manualIntervalDays: profile.manualPurchaseIntervalDays,
        };
        const snapshot = calculatePurchaseRecurrenceSnapshot({
          purchaseDates,
          manualProfile: configuration.manualProfile,
          manualIntervalDays: configuration.manualIntervalDays,
          today,
        });
        const same =
          profile.purchaseRecurrenceCalculatedAt != null &&
          profile.purchaseFunnelStage === snapshot.purchaseFunnelStage &&
          profile.purchaseIntervalDays === snapshot.purchaseIntervalDays &&
          profile.purchaseIntervalSource === snapshot.purchaseIntervalSource &&
          profile.observedPurchaseIntervalDays ===
            snapshot.observedPurchaseIntervalDays &&
          profile.lastValidPurchaseDate === snapshot.lastValidPurchaseDate &&
          profile.purchaseRecurrenceSampleSize ===
            snapshot.purchaseRecurrenceSampleSize &&
          profile.nextPurchaseFunnelTransitionDate ===
            snapshot.nextPurchaseFunnelTransitionDate &&
          profile.manualPurchaseProfile === snapshot.manualPurchaseProfile &&
          profile.manualPurchaseIntervalDays ===
            snapshot.manualPurchaseIntervalDays;
        if (same) continue;
        changed = true;
        await tx
          .update(facilityVerticalProfiles)
          .set(snapshotSet(snapshot, configuration))
          .where(eq(facilityVerticalProfiles.id, profile.id));
      }

      if (changed || profiles.some((p) => p.purchaseRecurrenceCalculatedAt == null)) {
        await applyFacilityRollup(tx, facilityId);
        changed = true;
      }

      return { changed };
    });
  }
}
