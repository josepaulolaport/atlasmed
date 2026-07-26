import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import {
  facilities,
  facilityProfessionals,
  facilityVerticalProfiles,
  professionals,
} from "@atlasmed/database";
import { normalizeSearchFilterValue } from "@atlasmed/cnes-ingestion";
import { Meilisearch } from "meilisearch";
import { environment } from "@atlasmed/config";
import { db } from "../infrastructure/db";

export type SearchSyncTarget = "facilities" | "professionals";

export type FacilitySearchDocument = {
  id: string;
  name: string;
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  cpf: string | null;
  cnesCode: string | null;
  city: string | null;
  state: string | null;
  /** Active facility_vertical_profiles vertical ids. */
  verticalIds: string[];
  /** Active profile territory ids (membership). */
  territoryIds: string[];
  territoryAssignmentStatus: string;
  _geo?: { lat: number; lng: number };
};

export type ProfessionalSearchDocument = {
  id: string;
  name: string;
  socialName: string | null;
  taxId: string | null;
  specialty: string | null;
  specialtyNormalized: string | null;
  activeFacilityIds: string[];
  activeTerritoryIds: string[];
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

export function mapFacilitySearchDocument(row: {
  id: string;
  displayName: string;
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  cpf: string | null;
  cnesCode: string | null;
  city: string | null;
  state: string | null;
  verticalIds?: string[];
  territoryIds?: string[];
  territoryAssignmentStatus: string;
  latitude: number | null;
  longitude: number | null;
  deactivatedAt: Date | null;
  isActiveInRegistry: boolean;
}): FacilitySearchDocument | null {
  if (row.deactivatedAt) return null;

  return {
    id: row.id,
    name: row.displayName,
    legalName: row.legalName,
    tradeName: row.tradeName,
    cnpj: row.cnpj,
    cpf: row.cpf,
    cnesCode: row.cnesCode,
    city: row.city,
    state: row.state,
    verticalIds: row.verticalIds ?? [],
    territoryIds: row.territoryIds ?? [],
    territoryAssignmentStatus: row.territoryAssignmentStatus,
    ...(row.latitude !== null && row.longitude !== null
      ? { _geo: { lat: row.latitude, lng: row.longitude } }
      : {}),
  };
}

export function mapProfessionalSearchDocument(row: {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string | null;
  socialName: string | null;
  taxId: string | null;
  primarySpecialtyLabel: string | null;
  crmCouncil: string | null;
  crmNumber: string | null;
  crmState: string | null;
  activeAssociations: Array<{ facilityId: string; territoryId: string | null }>;
  deletedAt: Date | null;
}): ProfessionalSearchDocument | null {
  if (row.deletedAt) return null;

  const activeFacilityIds = [...new Set(row.activeAssociations.map((association) => association.facilityId))].sort();
  const activeTerritoryIds = [...new Set(
    row.activeAssociations.flatMap((association) => association.territoryId ? [association.territoryId] : [])
  )].sort();

  return {
    id: row.id,
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
  searchableAttributes: ["name", "legalName", "tradeName", "cnpj", "cpf", "cnesCode", "city", "state"],
  filterableAttributes: [
    "id",
    "state",
    "city",
    "verticalIds",
    "territoryIds",
    "territoryAssignmentStatus",
    "_geo",
  ],
  sortableAttributes: ["_geo"],
};

async function loadActiveFacilityProfileIds(
  facilityIds: string[]
): Promise<{ verticalIds: Map<string, string[]>; territoryIds: Map<string, string[]> }> {
  const verticalIds = new Map<string, string[]>();
  const territoryIds = new Map<string, string[]>();
  if (facilityIds.length === 0) return { verticalIds, territoryIds };

  const rows = await db
    .select({
      facilityId: facilityVerticalProfiles.facilityId,
      verticalId: facilityVerticalProfiles.verticalId,
      territoryId: facilityVerticalProfiles.territoryId,
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
  }
  return { verticalIds, territoryIds };
}
export const PROFESSIONAL_SETTINGS = {
  searchableAttributes: ["name", "socialName", "taxId", "specialty", "crmCouncil", "crmNumber", "crmState"],
  filterableAttributes: ["specialtyNormalized", "activeFacilityIds", "activeTerritoryIds", "crmState"],
};

async function* facilityPages(): AsyncGenerator<FacilitySearchDocument[]> {
  let lastId: string | undefined;

  while (true) {
    const rows = await db
      .select({
        id: facilities.id,
        displayName: facilities.displayName,
        legalName: facilities.legalName,
        tradeName: facilities.tradeName,
        cnpj: facilities.cnpj,
        cpf: facilities.cpf,
        cnesCode: facilities.cnesCode,
        city: facilities.city,
        state: facilities.state,
        territoryAssignmentStatus: facilities.territoryAssignmentStatus,
        latitude: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        longitude: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        deactivatedAt: facilities.deactivatedAt,
        isActiveInRegistry: facilities.isActiveInRegistry,
      })
      .from(facilities)
      .where(and(isNull(facilities.deactivatedAt), lastId ? gt(facilities.id, lastId) : undefined))
      .orderBy(asc(facilities.id))
      .limit(PAGE_SIZE);
    if (rows.length === 0) return;

    lastId = rows.at(-1)!.id;
    const profileIds = await loadActiveFacilityProfileIds(rows.map((row) => row.id));
    yield rows
      .map((row) =>
        mapFacilitySearchDocument({
          ...row,
          verticalIds: profileIds.verticalIds.get(row.id) ?? [],
          territoryIds: profileIds.territoryIds.get(row.id) ?? [],
        })
      )
      .filter((row): row is FacilitySearchDocument => row !== null);
  }
}

async function loadActiveProfessionalAssociations(
  professionalIds: string[]
): Promise<Map<string, Array<{ facilityId: string; territoryId: string | null }>>> {
  if (professionalIds.length === 0) return new Map();

  const rows = await db
    .select({
      professionalId: facilityProfessionals.professionalId,
      facilityId: facilityProfessionals.facilityId,
      territoryId: facilityVerticalProfiles.territoryId,
    })
    .from(facilityProfessionals)
    .innerJoin(facilities, eq(facilityProfessionals.facilityId, facilities.id))
    .leftJoin(
      facilityVerticalProfiles,
      and(
        eq(facilityVerticalProfiles.facilityId, facilities.id),
        eq(facilityVerticalProfiles.isActive, true)
      )
    )
    .where(and(
      inArray(facilityProfessionals.professionalId, professionalIds),
      isNull(facilityProfessionals.endedAt),
      isNull(facilities.deactivatedAt)
    ));

  const associations = new Map<string, Array<{ facilityId: string; territoryId: string | null }>>();
  for (const row of rows) {
    const current = associations.get(row.professionalId) ?? [];
    const already = current.some(
      (entry) => entry.facilityId === row.facilityId && entry.territoryId === row.territoryId
    );
    if (!already) {
      current.push({ facilityId: row.facilityId, territoryId: row.territoryId });
      associations.set(row.professionalId, current);
    }
  }
  return associations;
}

async function* professionalPages(): AsyncGenerator<ProfessionalSearchDocument[]> {
  let lastId: string | undefined;

  while (true) {
    const rows = await db
      .select({
        id: professionals.id,
        firstName: professionals.firstName,
        lastName: professionals.lastName,
        fullName: professionals.fullName,
        socialName: professionals.socialName,
        taxId: professionals.taxId,
        primarySpecialtyLabel: professionals.primarySpecialtyLabel,
        crmCouncil: professionals.crmCouncil,
        crmNumber: professionals.crmNumber,
        crmState: professionals.crmState,
        deletedAt: professionals.deletedAt,
      })
      .from(professionals)
      .where(and(isNull(professionals.deletedAt), lastId ? gt(professionals.id, lastId) : undefined))
      .orderBy(asc(professionals.id))
      .limit(PAGE_SIZE);
    if (rows.length === 0) return;

    lastId = rows.at(-1)!.id;
    const associations = await loadActiveProfessionalAssociations(rows.map((row) => row.id));
    yield rows
      .map((row) => mapProfessionalSearchDocument({
        ...row,
        activeAssociations: associations.get(row.id) ?? [],
      }))
      .filter((row): row is ProfessionalSearchDocument => row !== null);
  }
}

export async function rebuildFullSearchIndex(target: SearchSyncTarget): Promise<void> {
  const temporaryIndex = `${target}__rebuild_${crypto.randomUUID().replaceAll("-", "")}`;

  await rebuildSearchIndex({
    target,
    temporaryIndex,
    search: createSearchClient(),
    settings: target === "facilities" ? FACILITY_SETTINGS : PROFESSIONAL_SETTINGS,
    pages: target === "facilities" ? facilityPages() : professionalPages(),
  });
}
