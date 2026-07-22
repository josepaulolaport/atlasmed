import { facilities, orders, type Database } from "@atlasmed/database";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityPurchaseRecurrenceRepository,
  ManualPurchaseConfiguration,
} from "../../../application/interfaces/facility-purchase-recurrence.repository.interface";
import type { FacilityRecord } from "../../../application/interfaces/facility.repository.interface";
import { mapFacility } from "./drizzle-facility.repository";

export class DrizzleFacilityPurchaseRecurrenceRepository
  implements FacilityPurchaseRecurrenceRepository {
  constructor(private readonly database: Database = db) {}

  async withLockedFacility<T>(
    facilityId: string,
    callback: Parameters<FacilityPurchaseRecurrenceRepository["withLockedFacility"]>[1],
    fields: Parameters<FacilityPurchaseRecurrenceRepository["withLockedFacility"]>[2] = {},
  ): Promise<{ result: T; facility: FacilityRecord } | null> {
    return this.database.transaction(async (tx) => {
      const lockedRows = await tx.execute(sql<{
        manual_purchase_profile: ManualPurchaseConfiguration["manualProfile"];
        manual_purchase_interval_days: number | null;
      }>`select manual_purchase_profile, manual_purchase_interval_days
          from ${facilities}
          where ${facilities.id} = ${facilityId} and ${facilities.deactivatedAt} is null
          for update`);
      const locked = lockedRows[0] as {
        manual_purchase_profile: ManualPurchaseConfiguration["manualProfile"];
        manual_purchase_interval_days: number | null;
      } | undefined;
      if (!locked) return null;

      const purchaseDates = await tx
        .select({ date: sql<string>`(${orders.orderedAt} at time zone 'UTC')::date`.as("purchase_date") })
        .from(orders)
        .where(and(
          eq(orders.facilityId, facilityId),
          inArray(orders.status, ["APPROVED", "INVOICED"]),
          inArray(orders.type, ["SALE", "CONSIGNMENT"]),
        ))
        .groupBy(sql`(${orders.orderedAt} at time zone 'UTC')::date`)
        .orderBy(sql`(${orders.orderedAt} at time zone 'UTC')::date desc`)
        .limit(13)
        .then((rows) => rows.map((row) => String(row.date)));

      const desired = await callback({
        purchaseDates,
        configuration: {
          manualProfile: locked.manual_purchase_profile,
          manualIntervalDays: locked.manual_purchase_interval_days,
        },
      });
      const [updated] = await tx.update(facilities).set({
        ...(fields.name !== undefined ? { displayName: fields.name } : {}),
        ...(fields.manuallyEditedAt !== undefined ? { manuallyEditedAt: fields.manuallyEditedAt } : {}),
        observedPurchaseIntervalDays: desired.snapshot.observedPurchaseIntervalDays,
        purchaseIntervalDays: desired.snapshot.purchaseIntervalDays,
        purchaseIntervalSource: desired.snapshot.purchaseIntervalSource,
        manualPurchaseProfile: desired.configuration.manualProfile,
        manualPurchaseIntervalDays: desired.configuration.manualIntervalDays,
        lastValidPurchaseDate: desired.snapshot.lastValidPurchaseDate,
        purchaseRecurrenceSampleSize: desired.snapshot.purchaseRecurrenceSampleSize,
        purchaseFunnelStage: desired.snapshot.purchaseFunnelStage,
        nextPurchaseFunnelTransitionDate: desired.snapshot.nextPurchaseFunnelTransitionDate,
        purchaseRecurrenceCalculatedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(facilities.id, facilityId)).returning();
      if (!updated) return null;
      return { result: desired.result as T, facility: mapFacility(updated) };
    });
  }
}
