import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import {
  facilities,
  facilityVerticalProfiles,
  municipalities,
  states,
} from "@atlasmed/database";
import { normalizeSearchFilterValue } from "./normalize-search-filter";
import {
  PURCHASE_FUNNEL_STAGES,
  type PurchaseFunnelStage,
  type PurchaseIntervalSource,
  type PurchaseProfile,
} from "@atlasmed/facility-insights";
import { Meilisearch } from "meilisearch";
import { environment } from "@atlasmed/config";
import { db } from "../infrastructure/db";

export type SearchSyncTarget = "facilities" | "persons";

export type FacilityProfileFunnelData = {
  verticalId: number;
  purchaseFunnelStage: PurchaseFunnelStage;
  purchaseIntervalDays: number;
  purchaseIntervalSource: PurchaseIntervalSource;
  manualPurchaseProfile: PurchaseProfile | null;
  lastValidPurchaseDate: string | null;
};

export type FacilitySearchDocument = {
  /** Meilisearch primary key (decimal string of CRM bigint id). */
  id: string;
  name: string;
  legalName: string | null;
  tradeName: string | null;
  legalDocument: string | null;
  cnesCode: string | null;
  city: string | null;
  state: string | null;
  /** Active facility_vertical_profiles vertical ids. */
  verticalIds: number[];
  /** Active profile territory ids (membership). */
  territoryIds: number[];
  territoryAssignmentStatus: string;
  verticalFunnelStages: string[];
  verticalPurchaseIntervalSources: string[];
  verticalManualPurchaseProfiles: string[];
  purchaseFunnelStagesAny: string[];
  purchaseFunnelStageRank: number;
  purchaseIntervalDaysMin: number;
  hasLastValidPurchase: 0 | 1;
  lastValidPurchaseSortAt: number;
  _geo?: { lat: number; lng: number };
};

export type PersonSearchDocument = {
  /** Meilisearch primary key (decimal string of CRM bigint id). */
  id: string;
  name: string;
  socialName: string | null;
  taxId: string | null;
  specialty: string | null;
  specialtyNormalized: string | null;
  activeFacilityIds: number[];
  activeTerritoryIds: number[];
  crmCouncil: string | null;
  crmNumber: string | null;
  crmState: string | null;
};

type EnqueuedTask = { taskUid: number };
export type SearchIndexClient = {
  createIndex(uid: string, options?: { primaryKey?: string }): Promise<EnqueuedTask>;
  getIndex(uid: string): Promise<unknown>;
  updateSettings(uid: string, settings: Record<string, unknown>): Promise<EnqueuedTask>;
  addDocuments(uid: string, documents: unknown[], options?: { primaryKey?: string }): Promise<EnqueuedTask>;
  waitForTask(task: number): Promise<unknown>;
  swapIndexes(params: Array<{ indexes: [string, string] }>): Promise<EnqueuedTask>;
  deleteIndex(uid: string): Promise<EnqueuedTask>;
};

const PAGE_SIZE = 500;
const SEARCH_REBUILD_TASK_WAIT_OPTIONS = {
  // Leave ten minutes before the 120-minute Temporal activity deadline for cleanup/retry handling.
  timeout: 110 * 60 * 1_000,
  interval: 1_000,
} as const;

export function fullSearchSyncWorkflowId(target: SearchSyncTarget): string {
  return `search-sync-${target}-full`;
}

export function deriveFacilityProfileFunnelFields(profiles: FacilityProfileFunnelData[]): {
  verticalFunnelStages: string[];
  verticalPurchaseIntervalSources: string[];
  verticalManualPurchaseProfiles: string[];
  purchaseFunnelStagesAny: string[];
  purchaseFunnelStageRank: number;
  purchaseIntervalDaysMin: number;
  hasLastValidPurchase: 0 | 1;
  lastValidPurchaseSortAt: number;
} {
  const verticalFunnelStages = profiles.map(
    (profile) => `${profile.verticalId}:${profile.purchaseFunnelStage}`,
  );
  const verticalPurchaseIntervalSources = profiles.map(
    (profile) => `${profile.verticalId}:${profile.purchaseIntervalSource}`,
  );
  const verticalManualPurchaseProfiles = profiles.flatMap((profile) =>
    profile.manualPurchaseProfile === null
      ? []
      : [`${profile.verticalId}:${profile.manualPurchaseProfile}`],
  );
  const purchaseFunnelStagesAny = [...new Set(profiles.map((profile) => profile.purchaseFunnelStage))];
  const purchaseFunnelStageRank = profiles.length === 0
    ? 0
    : Math.max(...profiles.map((profile) => PURCHASE_FUNNEL_STAGES.indexOf(profile.purchaseFunnelStage)));
  const purchaseIntervalDaysMin = profiles.length === 0
    ? 30
    : Math.min(...profiles.map((profile) => profile.purchaseIntervalDays));
  const lastValidPurchaseDates = profiles
    .map((profile) => profile.lastValidPurchaseDate)
    .filter((date): date is string => date !== null);
  const lastValidPurchaseSortAt = lastValidPurchaseDates.length === 0
    ? 0
    : Math.max(...lastValidPurchaseDates.map((date) => Date.parse(`${date}T00:00:00.000Z`)));

  return {
    verticalFunnelStages,
    verticalPurchaseIntervalSources,
    verticalManualPurchaseProfiles,
    purchaseFunnelStagesAny,
    purchaseFunnelStageRank,
    purchaseIntervalDaysMin,
    hasLastValidPurchase: lastValidPurchaseDates.length === 0 ? 0 : 1,
    lastValidPurchaseSortAt,
  };
}

export function mapFacilitySearchDocument(row: {
  id: number;
  displayName: string;
  legalName: string | null;
  tradeName: string | null;
  legalDocument: string | null;
  cnesCode: string | null;
  city: string | null;
  state: string | null;
  verticalIds?: number[];
  territoryIds?: number[];
  profileFunnelData?: FacilityProfileFunnelData[];
  latitude: number | null;
  longitude: number | null;
  deactivatedAt: Date | null;
}): FacilitySearchDocument | null {
  if (row.deactivatedAt) return null;

  const territoryIds = row.territoryIds ?? [];
  const profileFunnelData = row.profileFunnelData ?? [];

  return {
    id: String(row.id),
    name: row.displayName,
    legalName: row.legalName,
    tradeName: row.tradeName,
    legalDocument: row.legalDocument,
    cnesCode: row.cnesCode,
    city: row.city,
    state: row.state,
    verticalIds: row.verticalIds ?? [],
    territoryIds,
    territoryAssignmentStatus: territoryIds.length > 0 ? "assigned" : "unassigned",
    ...deriveFacilityProfileFunnelFields(profileFunnelData),
    ...(row.latitude !== null && row.longitude !== null
      ? { _geo: { lat: row.latitude, lng: row.longitude } }
      : {}),
  };
}

export function mapPersonSearchDocument(row: {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string | null;
  socialName: string | null;
  taxId: string | null;
  primarySpecialtyLabel: string | null;
  crmCouncil: string | null;
  crmNumber: string | null;
  crmState: string | null;
  activeAssociations: Array<{ facilityId: number; territoryId: number | null }>;
  deletedAt: Date | null;
}): PersonSearchDocument | null {
  if (row.deletedAt) return null;

  const activeFacilityIds = [...new Set(row.activeAssociations.map((association) => association.facilityId))].sort(
    (a, b) => a - b,
  );
  const activeTerritoryIds = [...new Set(
    row.activeAssociations.flatMap((association) => association.territoryId ? [association.territoryId] : [])
  )].sort((a, b) => a - b);

  return {
    id: String(row.id),
    name: row.fullName?.trim() || `${row.firstName} ${row.lastName}`.trim(),
    socialName: row.socialName,
    taxId: row.taxId,
    specialty: row.primarySpecialtyLabel,
    specialtyNormalized: row.primarySpecialtyLabel
      ? normalizeSearchFilterValue(row.primarySpecialtyLabel)
      : null,
    activeFacilityIds,
    activeTerritoryIds,
    crmCouncil: row.crmCouncil,
    crmNumber: row.crmNumber,
    crmState: row.crmState,
  };
}

/**
 * All Meilisearch writes wait for the corresponding task. A failure before the
 * swap leaves the stable index untouched; after the swap the temporary uid owns
 * the retired content and can safely be deleted.
 */
export async function rebuildSearchIndex(input: {
  target: SearchSyncTarget;
  temporaryIndex: string;
  search: SearchIndexClient;
  settings: Record<string, unknown>;
  pages: Iterable<unknown[]> | AsyncIterable<unknown[]>;
}): Promise<void> {
  await input.search.waitForTask(
    (await input.search.createIndex(input.temporaryIndex, { primaryKey: "id" })).taskUid
  );
  await input.search.waitForTask(
    (await input.search.updateSettings(input.temporaryIndex, input.settings)).taskUid
  );

  for await (const page of input.pages) {
    if (page.length > 0) {
      await input.search.waitForTask(
        (await input.search.addDocuments(input.temporaryIndex, page, { primaryKey: "id" })).taskUid
      );
    }
  }

  const hasStableIndex = await indexExists(input.search, input.target);
  if (!hasStableIndex) {
    // Meilisearch 1.13 swaps require both indexes to exist. Create the stable
    // placeholder only after the temporary index has been fully built, so a
    // failed first rebuild never exposes a partial active index.
    await input.search.waitForTask(
      (await input.search.createIndex(input.target, { primaryKey: "id" })).taskUid
    );
  }

  try {
    await input.search.waitForTask(
      (await input.search.swapIndexes([{ indexes: [input.target, input.temporaryIndex] }])).taskUid
    );
  } catch (error) {
    if (!hasStableIndex) {
      await input.search.waitForTask((await input.search.deleteIndex(input.target)).taskUid);
    }
    throw error;
  }

  await input.search.waitForTask((await input.search.deleteIndex(input.temporaryIndex)).taskUid);
}

function isIndexNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null
    && "cause" in error
    && typeof error.cause === "object"
    && error.cause !== null
    && "code" in error.cause
    && error.cause.code === "index_not_found";
}

async function indexExists(search: SearchIndexClient, index: string): Promise<boolean> {
  try {
    await search.getIndex(index);
    return true;
  } catch (error) {
    if (isIndexNotFound(error)) return false;
    throw error;
  }
}

export function createSearchIndexClient(client: Meilisearch): SearchIndexClient {
  return {
    createIndex: (uid, options) => client.createIndex(uid, options),
    getIndex: (uid) => client.getIndex(uid),
    updateSettings: (uid, settings) => client.index(uid).updateSettings(settings),
    addDocuments: (uid, documents, options) => client.index(uid).addDocuments(documents as Record<string, unknown>[], options),
    waitForTask: (taskUid) => client.tasks.waitForTask(taskUid, SEARCH_REBUILD_TASK_WAIT_OPTIONS),
    swapIndexes: (swaps) => client.swapIndexes(swaps.map(({ indexes }) => ({ indexes, rename: false }))),
    deleteIndex: (uid) => client.deleteIndex(uid),
  };
}

function createSearchClient(): SearchIndexClient {
  if (!environment.MEILISEARCH_URL) {
    throw new Error("Meilisearch is not configured");
  }

  return createSearchIndexClient(new Meilisearch({
    host: environment.MEILISEARCH_URL,
    ...(environment.MEILISEARCH_API_KEY ? { apiKey: environment.MEILISEARCH_API_KEY } : {}),
  }));
}

export const FACILITY_SETTINGS = {
  searchableAttributes: ["name", "legalName", "tradeName", "legalDocument", "cnesCode", "city", "state"],
  filterableAttributes: [
    "id",
    "state",
    "city",
    "verticalIds",
    "territoryIds",
    "territoryAssignmentStatus",
    "verticalFunnelStages",
    "verticalPurchaseIntervalSources",
    "verticalManualPurchaseProfiles",
    "purchaseFunnelStagesAny",
    "purchaseIntervalDaysMin",
    "_geo",
  ],
  sortableAttributes: ["_geo", "name", "purchaseFunnelStageRank", "purchaseIntervalDaysMin", "hasLastValidPurchase", "lastValidPurchaseSortAt", "id"],
  rankingRules: ["sort", "words", "typo", "proximity", "attribute", "exactness"],
};

type ActiveFacilityProfiles = {
  verticalIds: Map<number, number[]>;
  territoryIds: Map<number, number[]>;
  funnelData: Map<number, FacilityProfileFunnelData[]>;
};

async function loadActiveFacilityProfiles(facilityIds: number[]): Promise<ActiveFacilityProfiles> {
  const verticalIds = new Map<number, number[]>();
  const territoryIds = new Map<number, number[]>();
  const funnelData = new Map<number, FacilityProfileFunnelData[]>();
  if (facilityIds.length === 0) return { verticalIds, territoryIds, funnelData };

  const rows = await db
    .select({
      facilityId: facilityVerticalProfiles.facilityId,
      verticalId: facilityVerticalProfiles.verticalId,
      territoryId: facilityVerticalProfiles.managerZoneId,
      purchaseFunnelStage: facilityVerticalProfiles.purchaseFunnelStage,
      purchaseIntervalDays: facilityVerticalProfiles.purchaseIntervalDays,
      purchaseIntervalSource: facilityVerticalProfiles.purchaseIntervalSource,
      manualPurchaseProfile: facilityVerticalProfiles.manualPurchaseProfile,
      lastValidPurchaseDate: facilityVerticalProfiles.lastValidPurchaseDate,
    })
    .from(facilityVerticalProfiles)
    .where(
      and(
        inArray(facilityVerticalProfiles.facilityId, facilityIds),
        eq(facilityVerticalProfiles.isActive, true)
      )
    );

  for (const row of rows) {
    const verts = verticalIds.get(row.facilityId) ?? [];
    verts.push(row.verticalId);
    verticalIds.set(row.facilityId, verts);
    if (row.territoryId) {
      const territories = territoryIds.get(row.facilityId) ?? [];
      if (!territories.includes(row.territoryId)) {
        territories.push(row.territoryId);
      }
      territoryIds.set(row.facilityId, territories);
    }
    const profiles = funnelData.get(row.facilityId) ?? [];
    profiles.push({
      verticalId: row.verticalId,
      purchaseFunnelStage: row.purchaseFunnelStage,
      purchaseIntervalDays: row.purchaseIntervalDays,
      purchaseIntervalSource: row.purchaseIntervalSource,
      manualPurchaseProfile: row.manualPurchaseProfile,
      lastValidPurchaseDate: row.lastValidPurchaseDate === null
        ? null
        : String(row.lastValidPurchaseDate).slice(0, 10),
    });
    funnelData.set(row.facilityId, profiles);
  }
  return { verticalIds, territoryIds, funnelData };
}
export const PERSON_SETTINGS = {
  searchableAttributes: ["name", "socialName", "taxId", "specialty", "crmCouncil", "crmNumber", "crmState"],
  filterableAttributes: ["specialtyNormalized", "activeFacilityIds", "activeTerritoryIds", "crmState"],
};

async function* facilityPages(): AsyncGenerator<FacilitySearchDocument[]> {
  let lastId: number | undefined;

  while (true) {
    const rows = await db
      .select({
        id: facilities.id,
        displayName: facilities.displayName,
        legalName: facilities.legalName,
        tradeName: facilities.tradeName,
        legalDocument: facilities.legalDocument,
        cnesCode: facilities.cnesCode,
        city: municipalities.name,
        state: states.abbreviation,
        latitude: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        longitude: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        deactivatedAt: facilities.deactivatedAt,
      })
      .from(facilities)
      .innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
      .innerJoin(states, eq(states.id, facilities.stateId))
      .where(and(isNull(facilities.deactivatedAt), lastId ? gt(facilities.id, lastId) : undefined))
      .orderBy(asc(facilities.id))
      .limit(PAGE_SIZE);
    if (rows.length === 0) return;

    lastId = rows.at(-1)!.id;
    const profiles = await loadActiveFacilityProfiles(rows.map((row) => row.id));
    yield rows
      .map((row) =>
        mapFacilitySearchDocument({
          ...row,
          verticalIds: profiles.verticalIds.get(row.id) ?? [],
          territoryIds: profiles.territoryIds.get(row.id) ?? [],
          profileFunnelData: profiles.funnelData.get(row.id) ?? [],
        })
      )
      .filter((row): row is FacilitySearchDocument => row !== null);
  }
}

// TODO(ADR-0004): rebuild person search documents from persons + person_facilities.
async function* personPages(): AsyncGenerator<PersonSearchDocument[]> {
  return;
  yield [];
}

export async function rebuildFullSearchIndex(target: SearchSyncTarget): Promise<void> {
  const temporaryIndex = `${target}__rebuild_${crypto.randomUUID().replaceAll("-", "")}`;

  await rebuildSearchIndex({
    target,
    temporaryIndex,
    search: createSearchClient(),
    settings: target === "facilities" ? FACILITY_SETTINGS : PERSON_SETTINGS,
    pages: target === "facilities" ? facilityPages() : personPages(),
  });
}
