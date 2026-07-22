import { environment } from "@atlasmed/config";
import { facilities, orders, type Database } from "@atlasmed/database";
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
  type FacilitySearchDocument,
} from "../search/rebuild";

export type PurchaseRecurrenceMode = "BACKFILL" | "RECONCILE";

export interface PurchaseRecurrenceBatchInput {
  mode: PurchaseRecurrenceMode;
  cursor: string | null;
  limit: number;
  today: string;
  since?: string;
  until?: string;
  fullSweep?: boolean;
}

export interface PurchaseRecurrenceFailure {
  facilityId: string | null;
  message: string;
}

export interface PurchaseRecurrenceBatchResult {
  processed: number;
  updated: number;
  failed: number;
  nextCursor: string | null;
  failures: PurchaseRecurrenceFailure[];
}

export interface PurchaseRecurrenceStore {
  listBackfillFacilityIds(input: { cursor: string | null; limit: number }): Promise<string[]>;
  listChangedOrderFacilityIds(input: {
    cursor: string | null;
    limit: number;
    since: string;
    until: string;
  }): Promise<string[]>;
  listDueTransitionFacilityIds(input: {
    cursor: string | null;
    limit: number;
    today: string;
  }): Promise<string[]>;
  recalculateFacility(facilityId: string, today: string): Promise<{
    facilityId: string;
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
  changedOrderIds: readonly string[];
  dueTransitionIds: readonly string[];
  cursor: string | null;
  limit: number;
}): string[] {
  return [...new Set([...input.changedOrderIds, ...input.dueTransitionIds])]
    .filter((id) => input.cursor === null || id > input.cursor)
    .sort()
    .slice(0, input.limit);
}

function snapshotEquals(
  current: Record<string, unknown>,
  snapshot: PurchaseRecurrenceSnapshot,
): boolean {
  return current.observedPurchaseIntervalDays === snapshot.observedPurchaseIntervalDays
    && current.purchaseIntervalDays === snapshot.purchaseIntervalDays
    && current.purchaseIntervalSource === snapshot.purchaseIntervalSource
    && current.manualPurchaseProfile === snapshot.manualPurchaseProfile
    && current.manualPurchaseIntervalDays === snapshot.manualPurchaseIntervalDays
    && current.lastValidPurchaseDate === snapshot.lastValidPurchaseDate
    && current.purchaseRecurrenceSampleSize === snapshot.purchaseRecurrenceSampleSize
    && current.purchaseFunnelStage === snapshot.purchaseFunnelStage
    && current.nextPurchaseFunnelTransitionDate === snapshot.nextPurchaseFunnelTransitionDate;
}

export class DrizzlePurchaseRecurrenceStore implements PurchaseRecurrenceStore {
  constructor(private readonly database: Database = getDb()) {}

  async listBackfillFacilityIds(input: { cursor: string | null; limit: number }): Promise<string[]> {
    return this.database
      .select({ id: facilities.id })
      .from(facilities)
      .where(and(isNull(facilities.deactivatedAt), input.cursor ? gt(facilities.id, input.cursor) : undefined))
      .orderBy(asc(facilities.id))
      .limit(input.limit)
      .then((rows) => rows.map((row) => row.id));
  }

  async listChangedOrderFacilityIds(input: {
    cursor: string | null;
    limit: number;
    since: string;
    until: string;
  }): Promise<string[]> {
    const rows = await this.database.execute(sql<{ facility_id: string }>`
      select distinct o.facility_id
      from ${orders} o
      inner join ${facilities} f on f.id = o.facility_id
      where f.deactivated_at is null
        and o.updated_at >= ${new Date(input.since)}
        and o.updated_at < ${new Date(input.until)}
        and (${input.cursor}::text is null or o.facility_id > ${input.cursor})
      order by o.facility_id
      limit ${input.limit}
    `);
    return Array.from(rows, (row) => String((row as { facility_id: string }).facility_id));
  }

  async listDueTransitionFacilityIds(input: {
    cursor: string | null;
    limit: number;
    today: string;
  }): Promise<string[]> {
    return this.database
      .select({ id: facilities.id })
      .from(facilities)
      .where(and(
        isNull(facilities.deactivatedAt),
        lte(facilities.nextPurchaseFunnelTransitionDate, input.today),
        input.cursor ? gt(facilities.id, input.cursor) : undefined,
      ))
      .orderBy(asc(facilities.id))
      .limit(input.limit)
      .then((rows) => rows.map((row) => row.id));
  }

  async recalculateFacility(facilityId: string, today: string): Promise<{
    facilityId: string;
    changed: boolean;
    document: FacilitySearchDocument | null;
  }> {
    return this.database.transaction(async (tx) => {
      const lockedRows = await tx.execute(sql<{
        id: string;
        observed_purchase_interval_days: number | null;
        purchase_interval_days: number;
        purchase_interval_source: string;
        manual_purchase_profile: PurchaseProfile | null;
        manual_purchase_interval_days: number | null;
        last_valid_purchase_date: string | null;
        purchase_recurrence_sample_size: number;
        purchase_funnel_stage: string;
        next_purchase_funnel_transition_date: string | null;
      }>`
        select id, observed_purchase_interval_days, purchase_interval_days,
          purchase_interval_source, manual_purchase_profile, manual_purchase_interval_days,
          last_valid_purchase_date, purchase_recurrence_sample_size, purchase_funnel_stage,
          next_purchase_funnel_transition_date
        from ${facilities}
        where ${facilities.id} = ${facilityId} and ${facilities.deactivatedAt} is null
        for update
      `);
      const locked = lockedRows[0] as {
        id: string;
        observed_purchase_interval_days: number | null;
        purchase_interval_days: number;
        purchase_interval_source: string;
        manual_purchase_profile: PurchaseProfile | null;
        manual_purchase_interval_days: number | null;
        last_valid_purchase_date: string | null;
        purchase_recurrence_sample_size: number;
        purchase_funnel_stage: string;
        next_purchase_funnel_transition_date: string | null;
      } | undefined;
      if (!locked) return { facilityId, changed: false, document: null };

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

      const snapshot = calculatePurchaseRecurrenceSnapshot({
        purchaseDates,
        manualProfile: locked.manual_purchase_profile,
        manualIntervalDays: locked.manual_purchase_interval_days,
        today,
      });
      const current = {
        observedPurchaseIntervalDays: locked.observed_purchase_interval_days,
        purchaseIntervalDays: locked.purchase_interval_days,
        purchaseIntervalSource: locked.purchase_interval_source,
        manualPurchaseProfile: locked.manual_purchase_profile,
        manualPurchaseIntervalDays: locked.manual_purchase_interval_days,
        lastValidPurchaseDate: locked.last_valid_purchase_date,
        purchaseRecurrenceSampleSize: locked.purchase_recurrence_sample_size,
        purchaseFunnelStage: locked.purchase_funnel_stage,
        nextPurchaseFunnelTransitionDate: locked.next_purchase_funnel_transition_date,
      };
      if (snapshotEquals(current, snapshot)) return { facilityId, changed: false, document: null };

      const [row] = await tx.update(facilities).set({
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
      }).where(eq(facilities.id, facilityId)).returning({
        id: facilities.id,
        displayName: facilities.displayName,
        legalName: facilities.legalName,
        tradeName: facilities.tradeName,
        cnpj: facilities.cnpj,
        cpf: facilities.cpf,
        cnesCode: facilities.cnesCode,
        city: facilities.city,
        state: facilities.state,
        commercialStatus: facilities.commercialStatus,
        territoryId: facilities.territoryId,
        territoryAssignmentStatus: facilities.territoryAssignmentStatus,
        purchaseFunnelStage: facilities.purchaseFunnelStage,
        purchaseIntervalDays: facilities.purchaseIntervalDays,
        purchaseIntervalSource: facilities.purchaseIntervalSource,
        manualPurchaseProfile: facilities.manualPurchaseProfile,
        lastValidPurchaseDate: facilities.lastValidPurchaseDate,
        latitude: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        longitude: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        deactivatedAt: facilities.deactivatedAt,
        isActiveInRegistry: facilities.isActiveInRegistry,
      });
      return {
        facilityId,
        changed: true,
        document: row ? mapFacilitySearchDocument(row) : null,
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

export function createPurchaseRecurrenceBatchActivity(dependencies: {
  store: PurchaseRecurrenceStore;
  updateSearchDocuments: (documents: FacilitySearchDocument[]) => Promise<void>;
}) {
  return async function recalculatePurchaseRecurrenceBatch(
    input: PurchaseRecurrenceBatchInput,
  ): Promise<PurchaseRecurrenceBatchResult> {
    const startedAt = Date.now();
    let facilityIds: string[];
    if (input.mode === "BACKFILL" || input.fullSweep) {
      facilityIds = await dependencies.store.listBackfillFacilityIds({ cursor: input.cursor, limit: input.limit });
    } else {
      if (!input.since || !input.until) throw new Error("RECONCILE requires since and until");
      const [changedOrderIds, dueTransitionIds] = await Promise.all([
        dependencies.store.listChangedOrderFacilityIds({
          cursor: input.cursor,
          limit: input.limit,
          since: input.since,
          until: input.until,
        }),
        dependencies.store.listDueTransitionFacilityIds({
          cursor: input.cursor,
          limit: input.limit,
          today: input.today,
        }),
      ]);
      facilityIds = selectReconcileFacilityIds({ changedOrderIds, dueTransitionIds, cursor: input.cursor, limit: input.limit });
    }

    const failures: PurchaseRecurrenceFailure[] = [];
    const documents: FacilitySearchDocument[] = [];
    let updated = 0;
    for (const facilityId of facilityIds) {
      try {
        const result = await dependencies.store.recalculateFacility(facilityId, input.today);
        if (result.changed) {
          updated += 1;
          if (result.document) documents.push(result.document);
        }
      } catch (error) {
        failures.push({ facilityId, message: errorMessage(error) });
      }
    }

    if (documents.length > 0) {
      try {
        await dependencies.updateSearchDocuments(documents);
      } catch (error) {
        failures.push({ facilityId: null, message: `Meilisearch partial update failed: ${errorMessage(error)}` });
      }
    }

    const result = {
      processed: facilityIds.length,
      updated,
      failed: failures.length,
      nextCursor: facilityIds.at(-1) ?? null,
      failures: boundFailures(failures),
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

export const recalculatePurchaseRecurrenceBatch = createPurchaseRecurrenceBatchActivity({
  store: new DrizzlePurchaseRecurrenceStore(),
  updateSearchDocuments: updateFacilitySearchDocuments,
});
