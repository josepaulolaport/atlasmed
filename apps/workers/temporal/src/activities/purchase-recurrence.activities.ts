import { environment } from "@atlasmed/config";
import {
  facilities,
  facilityVerticalProfiles,
  facilityVerticalRepAssignments,
  municipalities,
  orders,
  states,
  type Database,
} from "@atlasmed/database";
import { ApplicationFailure } from "@temporalio/activity";
import {
  calculatePurchaseRecurrenceSnapshot,
  type PurchaseProfile,
  type PurchaseRecurrenceSnapshot,
} from "@atlasmed/facility-insights";
import { and, asc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { Meilisearch } from "meilisearch";
import { getDb } from "../infrastructure/db";
import { logger } from "../logger";
import {
  createSearchIndexClient,
  mapFacilitySearchDocument,
  type FacilityProfileFunnelData,
  type FacilitySearchDocument,
} from "../search/rebuild";

export type PurchaseRecurrenceMode = "BACKFILL" | "RECONCILE";

export interface PurchaseRecurrenceBatchInput {
  mode: PurchaseRecurrenceMode;
  cursor: number | null;
  limit: number;
  today: string;
  since?: string;
  until?: string;
  fullSweep?: boolean;
}

export interface PurchaseRecurrenceFailure {
  facilityId: number | null;
  message: string;
}

export interface PurchaseRecurrenceBatchResult {
  processed: number;
  updated: number;
  failed: number;
  nextCursor: number | null;
  failures: PurchaseRecurrenceFailure[];
}

export interface PurchaseRecurrenceStore {
  listBackfillFacilityIds(input: { cursor: number | null; limit: number }): Promise<number[]>;
  listChangedOrderFacilityIds(input: {
    cursor: number | null;
    limit: number;
    since: string;
    until: string;
  }): Promise<number[]>;
  listDueTransitionFacilityIds(input: {
    cursor: number | null;
    limit: number;
    today: string;
  }): Promise<number[]>;
  recalculateFacility(facilityId: number, today: string): Promise<{
    facilityId: number;
    changed: boolean;
    document: FacilitySearchDocument | null;
  }>;
}

const MAX_FAILURE_DETAILS = 20;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function boundFailures(failures: PurchaseRecurrenceFailure[]): PurchaseRecurrenceFailure[] {
  if (failures.length <= MAX_FAILURE_DETAILS) return failures;
  return [
    ...failures.slice(0, MAX_FAILURE_DETAILS - 1),
    { facilityId: null, message: `${failures.length - MAX_FAILURE_DETAILS + 1} additional failures omitted` },
  ];
}

export function selectReconcileFacilityIds(input: {
  changedOrderIds: readonly number[];
  dueTransitionIds: readonly number[];
  cursor: number | null;
  limit: number;
}): number[] {
  return [...new Set([...input.changedOrderIds, ...input.dueTransitionIds])]
    .filter((id) => input.cursor === null || id > input.cursor)
    .sort((a, b) => a - b)
    .slice(0, input.limit);
}

export function normalizePostgresDate(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function snapshotEquals(
  current: Record<string, unknown>,
  snapshot: PurchaseRecurrenceSnapshot,
): boolean {
  return current.observedPurchaseIntervalDays === snapshot.observedPurchaseIntervalDays
    && current.purchaseIntervalDays === snapshot.purchaseIntervalDays
    && current.purchaseIntervalSource === snapshot.purchaseIntervalSource
    && current.manualPurchaseProfile === snapshot.manualPurchaseProfile
    && current.manualPurchaseIntervalDays === snapshot.manualPurchaseIntervalDays
    && normalizePostgresDate(current.lastValidPurchaseDate as string | Date | null) === snapshot.lastValidPurchaseDate
    && current.purchaseRecurrenceSampleSize === snapshot.purchaseRecurrenceSampleSize
    && current.purchaseFunnelStage === snapshot.purchaseFunnelStage
    && normalizePostgresDate(current.nextPurchaseFunnelTransitionDate as string | Date | null) === snapshot.nextPurchaseFunnelTransitionDate;
}

export class DrizzlePurchaseRecurrenceStore implements PurchaseRecurrenceStore {
  constructor(private readonly database: Database = getDb()) {}

  async listBackfillFacilityIds(input: { cursor: number | null; limit: number }): Promise<number[]> {
    return this.database
      .select({ id: facilities.id })
      .from(facilities)
      .where(and(isNull(facilities.deactivatedAt), input.cursor ? gt(facilities.id, input.cursor) : undefined))
      .orderBy(asc(facilities.id))
      .limit(input.limit)
      .then((rows) => rows.map((row) => row.id));
  }

  async listChangedOrderFacilityIds(input: {
    cursor: number | null;
    limit: number;
    since: string;
    until: string;
  }): Promise<number[]> {
    const rows = await this.database.execute(sql<{ facility_id: number }>`
      select distinct o.facility_id
      from ${orders} o
      inner join ${facilities} f on f.id = o.facility_id
      where f.deactivated_at is null
        and o.updated_at >= ${new Date(input.since)}
        and o.updated_at < ${new Date(input.until)}
        and (${input.cursor} is null or o.facility_id > ${input.cursor})
      order by o.facility_id
      limit ${input.limit}
    `);
    return Array.from(rows, (row) => (row as { facility_id: number }).facility_id);
  }

  async listDueTransitionFacilityIds(input: {
    cursor: number | null;
    limit: number;
    today: string;
  }): Promise<number[]> {
    // Due transitions live on profiles; return distinct facility ids.
    const rows = await this.database
      .selectDistinct({ id: facilityVerticalProfiles.facilityId })
      .from(facilityVerticalProfiles)
      .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
      .where(and(
        isNull(facilities.deactivatedAt),
        eq(facilityVerticalProfiles.isActive, true),
        lte(facilityVerticalProfiles.nextPurchaseFunnelTransitionDate, input.today),
        input.cursor ? gt(facilityVerticalProfiles.facilityId, input.cursor) : undefined,
      ))
      .orderBy(asc(facilityVerticalProfiles.facilityId))
      .limit(input.limit);
    return rows.map((row) => row.id);
  }

  async recalculateFacility(facilityId: number, today: string): Promise<{
    facilityId: number;
    changed: boolean;
    document: FacilitySearchDocument | null;
  }> {
    return this.database.transaction(async (tx) => {
      const facilityAlive = await tx
        .select({ id: facilities.id })
        .from(facilities)
        .where(and(eq(facilities.id, facilityId), isNull(facilities.deactivatedAt)))
        .limit(1);
      if (!facilityAlive[0]) {
        return { facilityId, changed: false, document: null };
      }

      const profiles = await tx
        .select()
        .from(facilityVerticalProfiles)
        .where(and(
          eq(facilityVerticalProfiles.facilityId, facilityId),
          eq(facilityVerticalProfiles.isActive, true),
        ));

      let changed = false;
      const profileFunnelData: FacilityProfileFunnelData[] = [];

      for (const profile of profiles) {
        const purchaseDates = await tx
          .select({ date: sql<string | Date>`(${orders.orderedAt} at time zone 'UTC')::date`.as("purchase_date") })
          .from(orders)
          .where(and(
            eq(orders.facilityId, facilityId),
            eq(orders.verticalId, profile.verticalId),
            inArray(orders.status, ["APPROVED", "INVOICED"]),
            inArray(orders.type, ["SALE", "CONSIGNMENT"]),
          ))
          .groupBy(sql`(${orders.orderedAt} at time zone 'UTC')::date`)
          .orderBy(sql`(${orders.orderedAt} at time zone 'UTC')::date desc`)
          .limit(13)
          .then((rows) => rows
            .map((row) => normalizePostgresDate(row.date))
            .filter((date): date is string => date !== null));

        const snapshot = calculatePurchaseRecurrenceSnapshot({
          purchaseDates,
          manualProfile: profile.manualPurchaseProfile as PurchaseProfile | null,
          manualIntervalDays: profile.manualPurchaseIntervalDays,
          today,
        });
        const current = {
          observedPurchaseIntervalDays: profile.observedPurchaseIntervalDays,
          purchaseIntervalDays: profile.purchaseIntervalDays,
          purchaseIntervalSource: profile.purchaseIntervalSource,
          manualPurchaseProfile: profile.manualPurchaseProfile,
          manualPurchaseIntervalDays: profile.manualPurchaseIntervalDays,
          lastValidPurchaseDate: profile.lastValidPurchaseDate,
          purchaseRecurrenceSampleSize: profile.purchaseRecurrenceSampleSize,
          purchaseFunnelStage: profile.purchaseFunnelStage,
          nextPurchaseFunnelTransitionDate: profile.nextPurchaseFunnelTransitionDate,
        };
        const profileChanged =
          profile.purchaseRecurrenceCalculatedAt === null
          || !snapshotEquals(current, snapshot);
        if (profileChanged) {
          changed = true;
          await tx.update(facilityVerticalProfiles).set({
            observedPurchaseIntervalDays: snapshot.observedPurchaseIntervalDays,
            purchaseIntervalDays: snapshot.purchaseIntervalDays,
            purchaseIntervalSource: snapshot.purchaseIntervalSource,
            manualPurchaseProfile: snapshot.manualPurchaseProfile,
            manualPurchaseIntervalDays: snapshot.manualPurchaseIntervalDays,
            lastValidPurchaseDate: snapshot.lastValidPurchaseDate,
            purchaseRecurrenceSampleSize: snapshot.purchaseRecurrenceSampleSize,
            purchaseFunnelStage: snapshot.purchaseFunnelStage,
            nextPurchaseFunnelTransitionDate: snapshot.nextPurchaseFunnelTransitionDate,
            purchaseRecurrenceCalculatedAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(facilityVerticalProfiles.id, profile.id));
        }

        const effectiveSnapshot = profileChanged ? snapshot : {
          observedPurchaseIntervalDays: profile.observedPurchaseIntervalDays,
          purchaseIntervalDays: profile.purchaseIntervalDays,
          purchaseIntervalSource: profile.purchaseIntervalSource as PurchaseRecurrenceSnapshot["purchaseIntervalSource"],
          manualPurchaseProfile: profile.manualPurchaseProfile as PurchaseRecurrenceSnapshot["manualPurchaseProfile"],
          manualPurchaseIntervalDays: profile.manualPurchaseIntervalDays,
          lastValidPurchaseDate: normalizePostgresDate(profile.lastValidPurchaseDate),
          purchaseRecurrenceSampleSize: profile.purchaseRecurrenceSampleSize,
          purchaseFunnelStage: profile.purchaseFunnelStage as PurchaseRecurrenceSnapshot["purchaseFunnelStage"],
          nextPurchaseFunnelTransitionDate: normalizePostgresDate(profile.nextPurchaseFunnelTransitionDate),
        };
        profileFunnelData.push({
          verticalId: profile.verticalId,
          purchaseFunnelStage: effectiveSnapshot.purchaseFunnelStage,
          purchaseIntervalDays: effectiveSnapshot.purchaseIntervalDays,
          purchaseIntervalSource: effectiveSnapshot.purchaseIntervalSource,
          manualPurchaseProfile: effectiveSnapshot.manualPurchaseProfile,
          lastValidPurchaseDate: effectiveSnapshot.lastValidPurchaseDate,
        });
      }

      const profileIds = profiles.map((profile) => profile.id);
      const repRows = profileIds.length === 0
        ? []
        : await tx
          .select({ userId: facilityVerticalRepAssignments.userId })
          .from(facilityVerticalRepAssignments)
          .where(and(
            inArray(facilityVerticalRepAssignments.facilityVerticalProfileId, profileIds),
            isNull(facilityVerticalRepAssignments.endedAt),
          ));

      const [row] = await tx.select({
        id: facilities.id,
        displayName: facilities.displayName,
        legalName: facilities.legalName,
        tradeName: facilities.tradeName,
        legalDocument: facilities.legalDocument,
        cnesCode: facilities.cnesCode,
        city: municipalities.name,
        state: states.abbreviation,
        streetAddress: facilities.streetAddress,
        neighborhood: facilities.neighborhood,
        latitude: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        longitude: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        deactivatedAt: facilities.deactivatedAt,
      }).from(facilities)
        .innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
        .innerJoin(states, eq(states.id, facilities.stateId))
        .where(eq(facilities.id, facilityId)).limit(1);
      return {
        facilityId,
        changed,
        document: row ? mapFacilitySearchDocument({
          ...row,
          verticalIds: profileFunnelData.map((profile) => profile.verticalId),
          territoryIds: [...new Set(profiles.flatMap((profile) => profile.managerZoneId ? [profile.managerZoneId] : []))],
          repUserIds: repRows.map((rep) => rep.userId),
          profileFunnelData,
        }) : null,
      };
    });
  }
}

async function updateFacilitySearchDocuments(documents: FacilitySearchDocument[]): Promise<void> {
  if (documents.length === 0) return;
  if (!environment.MEILISEARCH_URL) throw new Error("Meilisearch is not configured");
  const search = createSearchIndexClient(new Meilisearch({
    host: environment.MEILISEARCH_URL,
    ...(environment.MEILISEARCH_API_KEY ? { apiKey: environment.MEILISEARCH_API_KEY } : {}),
  }));
  const task = await search.addDocuments("facilities", documents, { primaryKey: "id" });
  await search.waitForTask(task.taskUid);
}

async function deleteFacilitySearchDocuments(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  if (!environment.MEILISEARCH_URL) throw new Error("Meilisearch is not configured");
  const search = createSearchIndexClient(new Meilisearch({
    host: environment.MEILISEARCH_URL,
    ...(environment.MEILISEARCH_API_KEY ? { apiKey: environment.MEILISEARCH_API_KEY } : {}),
  }));
  const task = await search.deleteDocuments(
    "facilities",
    ids.map((id) => String(id)),
  );
  await search.waitForTask(task.taskUid);
}

export function createPurchaseRecurrenceBatchActivity(dependencies: {
  store: PurchaseRecurrenceStore;
  updateSearchDocuments: (documents: FacilitySearchDocument[]) => Promise<void>;
  deleteSearchDocuments?: (ids: number[]) => Promise<void>;
}) {
  return async function recalculatePurchaseRecurrenceBatch(
    input: PurchaseRecurrenceBatchInput,
  ): Promise<PurchaseRecurrenceBatchResult> {
    const startedAt = Date.now();
    if (input.mode === "RECONCILE" && (!input.since || !input.until)) {
      const message = "RECONCILE requires since and until";
      logger.error("facility_purchase_recurrence.batch_validation_failed", {
        mode: input.mode,
        cursor: input.cursor ?? undefined,
        message,
      });
      throw ApplicationFailure.nonRetryable(message, "PurchaseRecurrenceValidationFailure");
    }

    let facilityIds: number[];
    try {
      if (input.mode === "BACKFILL" || input.fullSweep) {
        facilityIds = await dependencies.store.listBackfillFacilityIds({ cursor: input.cursor, limit: input.limit });
      } else {
        const [changedOrderIds, dueTransitionIds] = await Promise.all([
          dependencies.store.listChangedOrderFacilityIds({
            cursor: input.cursor,
            limit: input.limit,
            since: input.since!,
            until: input.until!,
          }),
          dependencies.store.listDueTransitionFacilityIds({
            cursor: input.cursor,
            limit: input.limit,
            today: input.today,
          }),
        ]);
        facilityIds = selectReconcileFacilityIds({ changedOrderIds, dueTransitionIds, cursor: input.cursor, limit: input.limit });
      }
    } catch (error) {
      const failure = { facilityId: null, message: errorMessage(error) };
      logger.error("facility_purchase_recurrence.batch_page_selection_failed", {
        mode: input.mode,
        cursor: input.cursor ?? undefined,
        failure,
      });
      throw ApplicationFailure.retryable(
        `Purchase recurrence page selection failed: ${failure.message}`,
        "PurchaseRecurrenceDatabaseFailure",
        [failure],
      );
    }

    const failures: PurchaseRecurrenceFailure[] = [];
    const documents: FacilitySearchDocument[] = [];
    const deleteIds: number[] = [];
    let updated = 0;
    for (const facilityId of facilityIds) {
      try {
        const result = await dependencies.store.recalculateFacility(facilityId, input.today);
        if (result.changed) updated += 1;
        // Re-publish no-op snapshots too: a prior DB commit may have outlived a failed search update.
        if (result.document) {
          documents.push(result.document);
        } else {
          // Deactivated / unindexable — remove ghost Meili docs.
          deleteIds.push(facilityId);
        }
      } catch (error) {
        failures.push({ facilityId, message: errorMessage(error) });
      }
    }

    if (failures.length > 0) {
      const bounded = boundFailures(failures);
      logger.error("facility_purchase_recurrence.batch_failed", {
        mode: input.mode,
        failed: failures.length,
        failures: bounded,
        cursor: input.cursor ?? undefined,
      });
      throw ApplicationFailure.retryable(
        `Purchase recurrence database recalculation failed for ${failures.length} facilities`,
        "PurchaseRecurrenceDatabaseFailure",
        bounded,
      );
    }

    if (documents.length > 0) {
      try {
        await dependencies.updateSearchDocuments(documents);
      } catch (error) {
        const failure = { facilityId: null, message: `Meilisearch partial update failed: ${errorMessage(error)}` };
        logger.error("facility_purchase_recurrence.search_publication_failed", {
          mode: input.mode,
          processed: facilityIds.length,
          cursor: input.cursor ?? undefined,
          failure,
        });
        throw ApplicationFailure.retryable(
          failure.message,
          "PurchaseRecurrenceSearchPublicationFailure",
          [failure],
        );
      }
    }

    if (deleteIds.length > 0 && dependencies.deleteSearchDocuments) {
      try {
        await dependencies.deleteSearchDocuments(deleteIds);
      } catch (error) {
        const failure = { facilityId: null, message: `Meilisearch delete failed: ${errorMessage(error)}` };
        logger.error("facility_purchase_recurrence.search_delete_failed", {
          mode: input.mode,
          processed: facilityIds.length,
          cursor: input.cursor ?? undefined,
          failure,
        });
        throw ApplicationFailure.retryable(
          failure.message,
          "PurchaseRecurrenceSearchPublicationFailure",
          [failure],
        );
      }
    }

    const result = {
      processed: facilityIds.length,
      updated,
      failed: 0,
      nextCursor: facilityIds.at(-1) ?? null,
      failures: [],
    };
    logger.info(
      input.mode === "BACKFILL"
        ? "facility_purchase_recurrence.backfill_batch_completed"
        : "facility_purchase_recurrence.reconcile_batch_completed",
      {
        processed: result.processed,
        updated: result.updated,
        failed: result.failed,
        nextCursor: result.nextCursor ?? undefined,
        failures: result.failures.length,
        durationMs: Date.now() - startedAt,
      },
    );
    return result;
  };
}

export interface PurchaseRecurrenceLifecycleLogInput {
  action:
    | "facility_purchase_recurrence.backfill_started"
    | "facility_purchase_recurrence.backfill_completed"
    | "facility_purchase_recurrence.reconcile_started"
    | "facility_purchase_recurrence.reconcile_completed";
  mode: PurchaseRecurrenceMode;
  today: string;
  fullSweep: boolean;
  processed: number;
  updated: number;
  failed: number;
  durationMs: number;
}

export async function logPurchaseRecurrenceLifecycle(input: PurchaseRecurrenceLifecycleLogInput): Promise<void> {
  logger.info(input.action, {
    mode: input.mode,
    today: input.today,
    fullSweep: input.fullSweep,
    processed: input.processed,
    updated: input.updated,
    failed: input.failed,
    durationMs: input.durationMs,
  });
}

export const recalculatePurchaseRecurrenceBatch = createPurchaseRecurrenceBatchActivity({
  store: new DrizzlePurchaseRecurrenceStore(),
  updateSearchDocuments: updateFacilitySearchDocuments,
  deleteSearchDocuments: deleteFacilitySearchDocuments,
});
