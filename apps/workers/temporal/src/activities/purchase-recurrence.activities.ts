import { environment } from "@atlasmed/config";
import {
  facilities,
  facilityClinicalFocuses,
  facilityVerticalProfiles,
  facilityVerticalRepAssignments,
  municipalities,
  orders,
  purchaseRecurrenceWatermark,
  states,
  type Database,
} from "@atlasmed/database";
import { ApplicationFailure } from "@temporalio/activity";
import {
  APPLICATION_TIMEZONE,
  calculatePurchaseRecurrenceSnapshot,
  type PurchaseProfile,
  type PurchaseRecurrenceSnapshot,
} from "@atlasmed/facility-insights";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { Meilisearch } from "meilisearch";
import { getDb } from "../infrastructure/db";
import { logger } from "../logger";
import {
  FACILITY_DOCUMENT_COLUMNS,
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
  /**
   * Profiles whose snapshot has been invalidated — never calculated, or
   * explicitly cleared because the orders underneath them moved.
   *
   * Neither of the other two selectors can find these. `listChangedOrderFacilityIds`
   * reaches a facility by joining an order to its profile, so a clinic that
   * *lost* an order is reachable from nothing; `listDueTransitionFacilityIds`
   * needs a transition date, and a brand-new profile has none.
   */
  listInvalidatedFacilityIds(input: {
    cursor: number | null;
    limit: number;
  }): Promise<number[]>;
  /** How far a completed reconcile has covered, or null before the first one. */
  readCoveredUntil(): Promise<string | null>;
  /** Advances the watermark, never backwards. */
  commitCoveredUntil(until: string): Promise<void>;
  /**
   * Recalculates a whole page at once.
   *
   * Per facility this used to be one transaction and four round trips, plus one
   * order query per profile — roughly 2,000 round trips for a 500-facility page,
   * all serial. Every read here is now one query for the page.
   */
  recalculateFacilities(facilityIds: number[], today: string): Promise<Array<{
    facilityId: number;
    changed: boolean;
    document: FacilitySearchDocument | null;
  }>>;
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
  invalidatedIds?: readonly number[];
  cursor: number | null;
  limit: number;
}): number[] {
  return [...new Set([
    ...input.changedOrderIds,
    ...input.dueTransitionIds,
    ...(input.invalidatedIds ?? []),
  ])]
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

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const PURCHASE_DATE_LIMIT = 13;
const WATERMARK_ROW_ID = 1;

/** The lookback used before a watermark exists — twice the schedule interval. */
export const DEFAULT_RECONCILE_LOOKBACK_HOURS = 2;

/**
 * Past this, re-cover everything instead of widening the window.
 *
 * A worker down for a day leaves a watermark far enough behind that the
 * incremental query stops being the cheap one, and a very wide window is also
 * the case where being slow matters most. Sweeping is bounded work with the same
 * outcome.
 */
export const MAX_RECONCILE_WINDOW_HOURS = 24;

export function planReconcileWindow(input: {
  coveredUntil: string | null;
  until: string;
  lookbackHours?: number;
  maxWindowHours?: number;
}): { since: string; fullSweep: boolean } {
  const until = Date.parse(input.until);
  const lookbackHours = input.lookbackHours ?? DEFAULT_RECONCILE_LOOKBACK_HOURS;
  const maxWindowHours = input.maxWindowHours ?? MAX_RECONCILE_WINDOW_HOURS;
  const fallback = new Date(until - lookbackHours * 3_600_000).toISOString();

  if (input.coveredUntil === null) return { since: fallback, fullSweep: false };

  const covered = Date.parse(input.coveredUntil);
  // A watermark ahead of this run means a later run already committed — take the
  // fallback rather than an empty or inverted window.
  if (!Number.isFinite(covered) || covered >= until) {
    return { since: fallback, fullSweep: false };
  }
  if (until - covered > maxWindowHours * 3_600_000) {
    return { since: new Date(covered).toISOString(), fullSweep: true };
  }
  // Never *narrower* than the fallback: overlap is free and cheap, and it covers
  // an order committed just after a run read its window.
  return {
    since: covered < Date.parse(fallback) ? new Date(covered).toISOString() : fallback,
    fullSweep: false,
  };
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

/**
 * The 13 most recent distinct purchase days for every profile on the page.
 *
 * One query for the whole page. It was one query *per profile*, which is where a
 * 500-facility page spent most of its wall clock.
 *
 * Dates are civil days in São Paulo, not UTC. `ordered_at` is `timestamp without
 * time zone`, and the old expression cast through `AT TIME ZONE 'UTC'` to
 * `::date`, which resolves against the *session* `TimeZone` — correct only
 * because the server happens to run as `Etc/UTC`. It is explicit now, and it
 * agrees with `market-metric.ts` and migration 0090, which already bucket by São
 * Paulo. On the current data every eligible order is stamped 12:00 UTC, so this
 * changes no stored value today; it stops being luck.
 *
 * The status/type predicate must stay identical to the partial index
 * `orders_valid_purchase_profile_ordered_at_idx`. If they drift this degrades to
 * a sequential scan over every order and nothing fails loudly.
 */
async function loadPurchaseDatesByProfile(
  tx: Tx,
  profileIds: number[],
): Promise<Map<number, string[]>> {
  const dates = new Map<number, string[]>();
  if (profileIds.length === 0) return dates;

  const purchaseDate = sql<string | Date>`(${orders.orderedAt} at time zone 'UTC' at time zone ${APPLICATION_TIMEZONE})::date`;

  const distinctDates = tx
    .selectDistinct({
      profileId: orders.facilityVerticalProfileId,
      purchaseDate: purchaseDate.as("purchase_date"),
    })
    .from(orders)
    .where(and(
      inArray(orders.facilityVerticalProfileId, profileIds),
      inArray(orders.status, ["APPROVED", "INVOICED"]),
      inArray(orders.type, ["SALE", "CONSIGNMENT"]),
    ))
    .as("distinct_dates");

  const ranked = tx
    .select({
      profileId: distinctDates.profileId,
      purchaseDate: distinctDates.purchaseDate,
      rank: sql<number>`row_number() over (
        partition by ${distinctDates.profileId}
        order by ${distinctDates.purchaseDate} desc
      )`.as("purchase_rank"),
    })
    .from(distinctDates)
    .as("ranked");

  const rows = await tx
    .select({ profileId: ranked.profileId, purchaseDate: ranked.purchaseDate })
    .from(ranked)
    .where(lte(ranked.rank, PURCHASE_DATE_LIMIT))
    .orderBy(asc(ranked.profileId), desc(ranked.purchaseDate));

  for (const row of rows) {
    const date = normalizePostgresDate(row.purchaseDate);
    if (date === null) continue;
    const current = dates.get(row.profileId);
    if (current) current.push(date);
    else dates.set(row.profileId, [date]);
  }
  return dates;
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
    /**
     * Orders key on the profile since spec 0010 §4, so the facility is one hop
     * away through `facility_vertical_profiles`.
     *
     * This was hand-written SQL selecting `o.facility_id` — the column that
     * re-keying removed. Nothing type-checked it and the store is mocked in the
     * unit tests, so every non-`fullSweep` reconcile failed at runtime with
     * `42703 column o.facility_id does not exist`: the hourly schedule, and the
     * child workflow the Emultec import starts after each successful page. The
     * funnel only ever refreshed on the midnight full sweep. Built through the
     * query builder now, so the next schema move breaks the build instead.
     *
     * Backed by orders_updated_at_profile_id_idx (updated_at, profile_id).
     */
    const rows = await this.database
      .selectDistinct({ id: facilityVerticalProfiles.facilityId })
      .from(orders)
      .innerJoin(
        facilityVerticalProfiles,
        eq(facilityVerticalProfiles.id, orders.facilityVerticalProfileId),
      )
      .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
      .where(and(
        isNull(facilities.deactivatedAt),
        gte(orders.updatedAt, new Date(input.since)),
        lt(orders.updatedAt, new Date(input.until)),
        input.cursor ? gt(facilityVerticalProfiles.facilityId, input.cursor) : undefined,
      ))
      .orderBy(asc(facilityVerticalProfiles.facilityId))
      .limit(input.limit);
    return rows.map((row) => row.id);
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

  async listInvalidatedFacilityIds(input: {
    cursor: number | null;
    limit: number;
  }): Promise<number[]> {
    // Backed by facility_vertical_profiles_invalidated_snapshot_idx.
    const rows = await this.database
      .selectDistinct({ id: facilityVerticalProfiles.facilityId })
      .from(facilityVerticalProfiles)
      .innerJoin(facilities, eq(facilities.id, facilityVerticalProfiles.facilityId))
      .where(and(
        isNull(facilities.deactivatedAt),
        eq(facilityVerticalProfiles.isActive, true),
        isNull(facilityVerticalProfiles.purchaseRecurrenceCalculatedAt),
        input.cursor ? gt(facilityVerticalProfiles.facilityId, input.cursor) : undefined,
      ))
      .orderBy(asc(facilityVerticalProfiles.facilityId))
      .limit(input.limit);
    return rows.map((row) => row.id);
  }

  async readCoveredUntil(): Promise<string | null> {
    const [row] = await this.database
      .select({ coveredUntil: purchaseRecurrenceWatermark.coveredUntil })
      .from(purchaseRecurrenceWatermark)
      .where(eq(purchaseRecurrenceWatermark.id, WATERMARK_ROW_ID))
      .limit(1);
    return row?.coveredUntil ? row.coveredUntil.toISOString() : null;
  }

  async commitCoveredUntil(until: string): Promise<void> {
    const coveredUntil = new Date(until);
    await this.database
      .insert(purchaseRecurrenceWatermark)
      .values({ id: WATERMARK_ROW_ID, coveredUntil })
      .onConflictDoUpdate({
        target: purchaseRecurrenceWatermark.id,
        // Never backwards. The hourly reconcile and the daily sweep both commit,
        // and the sweep can finish after an hourly run that started later.
        set: {
          coveredUntil: sql`greatest(${purchaseRecurrenceWatermark.coveredUntil}, excluded.covered_until)`,
          updatedAt: new Date(),
        },
      });
  }

  async recalculateFacilities(facilityIds: number[], today: string): Promise<Array<{
    facilityId: number;
    changed: boolean;
    document: FacilitySearchDocument | null;
  }>> {
    if (facilityIds.length === 0) return [];

    return this.database.transaction(async (tx) => {
      /**
       * The shared column list, not a local copy.
       *
       * The local copy is what broke this: it omitted `unitTypeId` and
       * `legalDocumentType`, and because the publication below is
       * `addDocuments` — replace, not merge — every facility this activity
       * touched was rewritten with both blanked. The daily sweep did it to every
       * active facility at once, and nothing errored: the clinics simply stopped
       * matching the unit-type and CPF/CNPJ filters, and the list path only
       * falls back to SQL when Meili returns *nothing*, so partial loss was
       * invisible until a full rebuild.
       */
      const rows = await tx.select(FACILITY_DOCUMENT_COLUMNS).from(facilities)
        .innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
        .innerJoin(states, eq(states.id, facilities.stateId))
        .where(and(inArray(facilities.id, facilityIds), isNull(facilities.deactivatedAt)));

      const aliveIds = rows.map((row) => row.id);
      if (aliveIds.length === 0) {
        return facilityIds.map((facilityId) => ({ facilityId, changed: false, document: null }));
      }

      const profiles = await tx
        .select()
        .from(facilityVerticalProfiles)
        .where(and(
          inArray(facilityVerticalProfiles.facilityId, aliveIds),
          eq(facilityVerticalProfiles.isActive, true),
        ));
      const profileIds = profiles.map((profile) => profile.id);

      const [purchaseDates, repRows, focusRows] = await Promise.all([
        loadPurchaseDatesByProfile(tx, profileIds),
        profileIds.length === 0
          ? Promise.resolve([] as Array<{ facilityVerticalProfileId: number; userId: number }>)
          : tx
            .select({
              facilityVerticalProfileId: facilityVerticalRepAssignments.facilityVerticalProfileId,
              userId: facilityVerticalRepAssignments.userId,
            })
            .from(facilityVerticalRepAssignments)
            .where(and(
              inArray(facilityVerticalRepAssignments.facilityVerticalProfileId, profileIds),
              isNull(facilityVerticalRepAssignments.endedAt),
            )),
        tx
          .select({
            facilityId: facilityClinicalFocuses.facilityId,
            clinicalFocusId: facilityClinicalFocuses.clinicalFocusId,
          })
          .from(facilityClinicalFocuses)
          .where(inArray(facilityClinicalFocuses.facilityId, aliveIds)),
      ]);

      const profilesByFacility = groupBy(profiles, (profile) => profile.facilityId);
      const repsByProfile = groupBy(repRows, (rep) => rep.facilityVerticalProfileId);
      const focusesByFacility = groupBy(focusRows, (focus) => focus.facilityId);

      const changedFacilityIds = new Set<number>();
      const funnelByFacility = new Map<number, FacilityProfileFunnelData[]>();

      for (const profile of profiles) {
        const snapshot = calculatePurchaseRecurrenceSnapshot({
          purchaseDates: purchaseDates.get(profile.id) ?? [],
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
          changedFacilityIds.add(profile.facilityId);
          // Only rows that actually moved are written, so a steady-state sweep
          // issues no updates at all. Left per row rather than one multi-row
          // statement: the set is small by construction and this stays typed.
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
          purchaseIntervalDays: profile.purchaseIntervalDays,
          purchaseIntervalSource: profile.purchaseIntervalSource as PurchaseRecurrenceSnapshot["purchaseIntervalSource"],
          manualPurchaseProfile: profile.manualPurchaseProfile as PurchaseRecurrenceSnapshot["manualPurchaseProfile"],
          lastValidPurchaseDate: normalizePostgresDate(profile.lastValidPurchaseDate),
          purchaseFunnelStage: profile.purchaseFunnelStage as PurchaseRecurrenceSnapshot["purchaseFunnelStage"],
        };
        const funnel = funnelByFacility.get(profile.facilityId) ?? [];
        funnel.push({
          verticalId: profile.verticalId,
          purchaseFunnelStage: effectiveSnapshot.purchaseFunnelStage,
          purchaseIntervalDays: effectiveSnapshot.purchaseIntervalDays,
          purchaseIntervalSource: effectiveSnapshot.purchaseIntervalSource,
          manualPurchaseProfile: effectiveSnapshot.manualPurchaseProfile,
          lastValidPurchaseDate: effectiveSnapshot.lastValidPurchaseDate,
        });
        funnelByFacility.set(profile.facilityId, funnel);
      }

      const byId = new Map(rows.map((row) => [row.id, row]));
      return facilityIds.map((facilityId) => {
        const row = byId.get(facilityId);
        // Absent or deactivated: no document, which the caller turns into a
        // Meili delete so a ghost cannot outlive the row.
        if (!row) return { facilityId, changed: false, document: null };

        const facilityProfiles = profilesByFacility.get(facilityId) ?? [];
        return {
          facilityId,
          changed: changedFacilityIds.has(facilityId),
          document: mapFacilitySearchDocument({
            ...row,
            verticalIds: facilityProfiles.map((profile) => profile.verticalId),
            territoryIds: [...new Set(facilityProfiles.flatMap((profile) =>
              profile.managerZoneId ? [profile.managerZoneId] : []))],
            repUserIds: facilityProfiles.flatMap((profile) =>
              (repsByProfile.get(profile.id) ?? []).map((rep) => rep.userId)),
            clinicalFocusIds: (focusesByFacility.get(facilityId) ?? [])
              .map((focus) => focus.clinicalFocusId),
            profileFunnelData: funnelByFacility.get(facilityId) ?? [],
          }),
        };
      });
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
        const [changedOrderIds, dueTransitionIds, invalidatedIds] = await Promise.all([
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
          dependencies.store.listInvalidatedFacilityIds({
            cursor: input.cursor,
            limit: input.limit,
          }),
        ]);
        facilityIds = selectReconcileFacilityIds({ changedOrderIds, dueTransitionIds, invalidatedIds, cursor: input.cursor, limit: input.limit });
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
    try {
      const results = await dependencies.store.recalculateFacilities(facilityIds, input.today);
      for (const result of results) {
        if (result.changed) updated += 1;
        // Re-publish no-op snapshots too: a prior DB commit may have outlived a failed search update.
        if (result.document) {
          documents.push(result.document);
        } else {
          // Deactivated / unindexable — remove ghost Meili docs.
          deleteIds.push(result.facilityId);
        }
      }
    } catch (error) {
      /**
       * The page is one transaction now, so a database error is the page's, not
       * one facility's. That is not a loss of detail: the old per-facility catch
       * collected failures and then threw retryable the moment there was one, so
       * a single bad row already failed the whole page. Recording the range keeps
       * the culprit findable.
       */
      failures.push({
        facilityId: null,
        message: `${errorMessage(error)} (facilities ${facilityIds.at(0)}..${facilityIds.at(-1)})`,
      });
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

export interface ReconcileWindowInput {
  until: string;
}

export interface ReconcileWindowPlan {
  since: string;
  fullSweep: boolean;
}

export function createClaimReconcileWindowActivity(dependencies: {
  store: Pick<PurchaseRecurrenceStore, "readCoveredUntil">;
}) {
  return async function claimPurchaseRecurrenceWindow(
    input: ReconcileWindowInput,
  ): Promise<ReconcileWindowPlan> {
    let coveredUntil: string | null = null;
    try {
      coveredUntil = await dependencies.store.readCoveredUntil();
    } catch (error) {
      throw ApplicationFailure.retryable(
        `Purchase recurrence watermark read failed: ${errorMessage(error)}`,
        "PurchaseRecurrenceDatabaseFailure",
      );
    }
    const plan = planReconcileWindow({ coveredUntil, until: input.until });
    logger.info("facility_purchase_recurrence.window_planned", {
      coveredUntil: coveredUntil ?? undefined,
      since: plan.since,
      until: input.until,
      fullSweep: plan.fullSweep,
    });
    return plan;
  };
}

export function createCommitReconcileWindowActivity(dependencies: {
  store: Pick<PurchaseRecurrenceStore, "commitCoveredUntil">;
}) {
  return async function commitPurchaseRecurrenceWindow(
    input: ReconcileWindowInput,
  ): Promise<void> {
    try {
      await dependencies.store.commitCoveredUntil(input.until);
    } catch (error) {
      // Retryable on purpose: dropping the commit would silently re-do the same
      // window forever, which is the failure this watermark exists to prevent.
      throw ApplicationFailure.retryable(
        `Purchase recurrence watermark commit failed: ${errorMessage(error)}`,
        "PurchaseRecurrenceDatabaseFailure",
      );
    }
    logger.info("facility_purchase_recurrence.window_committed", { until: input.until });
  };
}

export const claimPurchaseRecurrenceWindow = createClaimReconcileWindowActivity({
  store: new DrizzlePurchaseRecurrenceStore(),
});

export const commitPurchaseRecurrenceWindow = createCommitReconcileWindowActivity({
  store: new DrizzlePurchaseRecurrenceStore(),
});
