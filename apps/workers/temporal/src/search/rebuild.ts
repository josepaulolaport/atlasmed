import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import {
  facilities,
  facilityClinicalFocuses,
  facilityVerticalProfiles,
  facilityVerticalRepAssignments,
  healthcareSpecialties,
  municipalities,
  personFacilities,
  personHealthcareProfileSpecialties,
  personHealthcareProfiles,
  personProfessionalRegistrationCouncils,
  personProfessionalRegistrations,
  persons,
  states,
} from "@atlasmed/database";
import { normalizeSearchFilterValue } from "./normalize-search-filter";
import {
  buildAddressSearchSynonyms,
  deriveFacilityProfileFunnelFields,
  mapFacilitySearchDocument,
  type FacilityProfileFunnelData,
  type FacilitySearchDocument,
  type PurchaseFunnelStage,
  type PurchaseIntervalSource,
  type PurchaseProfile,
} from "@atlasmed/facility-insights";
import { Meilisearch } from "meilisearch";
import { environment } from "@atlasmed/config";
import { db } from "../infrastructure/db";
import {
  FACILITY_CANDIDATE_SETTINGS,
  facilityCandidatePages,
} from "./facility-candidates";

export type SearchSyncTarget = "facilities" | "persons" | "facility_candidates";

/** Re-export shared Meili facility document helpers (SoT: @atlasmed/facility-insights). */
export {
  deriveFacilityProfileFunnelFields,
  mapFacilitySearchDocument,
};
export type { FacilityProfileFunnelData, FacilitySearchDocument };

/**
 * Q31 Meili persons document fields (ADR 0004 §6.4):
 * id, name, socialName, cpf, specialty, specialtyNormalized,
 * activeFacilityIds, activeTerritoryIds, registrationDisplays.
 */
export type PersonSearchDocument = {
  /** Meilisearch primary key (decimal string of persons.id). */
  id: string;
  name: string;
  socialName: string | null;
  cpf: string | null;
  specialty: string | null;
  specialtyNormalized: string | null;
  /**
   * Every active facility link, whatever its nature.
   *
   * Deliberately NOT classification-scoped: this backs Meili scope enforcement
   * and the `facilityId` roster filter, both of which ask "is this person
   * attached to this clinic", not "do they practise there".
   */
  activeFacilityIds: number[];
  /**
   * Active links carrying the `HEALTHCARE_PROFESSIONAL` classification.
   *
   * Separate from [activeFacilityIds] because the two questions differ: a
   * person can be an administrative contact at a clinic without ever having
   * been clinically associated there. The associate-doctors picker excludes on
   * this one, matching its SQL condition — excluding on `activeFacilityIds`
   * hid such a doctor from the only screen able to add them, but only when the
   * rep typed a search (the Meili path), so the same sheet disagreed with
   * itself about who was already there.
   */
  clinicalFacilityIds: number[];
  activeTerritoryIds: number[];
  /** Active regs as `CRM/SP 123456` — searchable (multi-reg UI). */
  registrationDisplays: string[];
};

type EnqueuedTask = { taskUid: number };
export type SearchIndexClient = {
  createIndex(uid: string, options?: { primaryKey?: string }): Promise<EnqueuedTask>;
  getIndex(uid: string): Promise<unknown>;
  updateSettings(uid: string, settings: Record<string, unknown>): Promise<EnqueuedTask>;
  addDocuments(uid: string, documents: unknown[], options?: { primaryKey?: string }): Promise<EnqueuedTask>;
  deleteDocuments(uid: string, ids: string[]): Promise<EnqueuedTask>;
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

/**
 * Keep in sync with apps/api `formatPrimaryRegistrationDisplay`
 * (do not import across apps — trivial shared format).
 */
function formatRegistrationDisplay(input: {
  councilAbbreviation: string;
  stateCode: string;
  registrationNumber: string;
}): string {
  return `${input.councilAbbreviation}/${input.stateCode} ${input.registrationNumber}`;
}

export function mapPersonSearchDocument(row: {
  id: number;
  firstName: string;
  lastName: string;
  socialName: string | null;
  cpf: string | null;
  primarySpecialtyLabel: string | null;
  activeAssociations: Array<{
    facilityId: number;
    territoryId: number | null;
    /** Carries the HEALTHCARE_PROFESSIONAL classification at that facility. */
    isClinical?: boolean;
  }>;
  registrationDisplays?: string[];
  deletedAt: Date | null;
}): PersonSearchDocument | null {
  if (row.deletedAt) return null;

  const activeFacilityIds = [...new Set(row.activeAssociations.map((association) => association.facilityId))].sort(
    (a, b) => a - b,
  );
  const clinicalFacilityIds = [...new Set(
    row.activeAssociations.flatMap((association) =>
      association.isClinical ? [association.facilityId] : []
    )
  )].sort((a, b) => a - b);
  const activeTerritoryIds = [...new Set(
    row.activeAssociations.flatMap((association) => association.territoryId ? [association.territoryId] : [])
  )].sort((a, b) => a - b);

  return {
    id: String(row.id),
    name: `${row.firstName} ${row.lastName}`.trim(),
    socialName: row.socialName,
    cpf: row.cpf,
    specialty: row.primarySpecialtyLabel,
    specialtyNormalized: row.primarySpecialtyLabel
      ? normalizeSearchFilterValue(row.primarySpecialtyLabel)
      : null,
    activeFacilityIds,
    clinicalFacilityIds,
    activeTerritoryIds,
    registrationDisplays: row.registrationDisplays ?? [],
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

  /*
   * Enqueue every page, then wait once.
   *
   * Waiting per page serialises the whole rebuild *and* defeats Meilisearch's
   * own batching: it merges consecutive queued documentAdditionOrUpdate tasks
   * into one indexing pass, but only if several are sitting in the queue. Waiting
   * guaranteed one task per batch — measured on 1.48.3 as `totalNbTasks: 1` on
   * every batch and 4.8-7.1 s each, which is where a nineteen-minute rebuild of
   * 373 435 narrow documents went.
   *
   * The tasks are still all awaited before the swap below, so a failure is still
   * fatal to the rebuild — it just surfaces at the end. That costs nothing: this
   * writes into a temporary index that only becomes live on success.
   */
  const pending: number[] = [];
  for await (const page of input.pages) {
    if (page.length > 0) {
      pending.push(
        (await input.search.addDocuments(input.temporaryIndex, page, { primaryKey: "id" })).taskUid
      );
    }
  }
  for (const taskUid of pending) {
    await input.search.waitForTask(taskUid);
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
    deleteDocuments: (uid, ids) => client.index(uid).deleteDocuments(ids),
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
  searchableAttributes: [
    "name",
    "legalName",
    "tradeName",
    "legalDocument",
    "cnesCode",
    "city",
    "state",
    "streetAddress",
    "neighborhood",
  ],
  filterableAttributes: [
    "id",
    "state",
    "city",
    "verticalIds",
    "territoryIds",
    "repUserIds",
    "territoryAssignmentStatus",
    "verticalFunnelStages",
    "verticalPurchaseIntervalSources",
    "verticalManualPurchaseProfiles",
    "purchaseFunnelStagesAny",
    "purchaseIntervalDaysMin",
    "unitTypeId",
    "legalDocumentType",
    "clinicalFocusIds",
    "_geo",
  ],
  sortableAttributes: ["_geo", "name", "purchaseFunnelStageRank", "purchaseIntervalDaysMin", "hasLastValidPurchase", "lastValidPurchaseSortAt", "id"],
  rankingRules: ["sort", "words", "typo", "proximity", "attribute", "exactness"],
  // Street types, so "Avenida das Americas" reaches the 436 addresses stored
  // as "Av.". Typo tolerance cannot bridge that on its own: it allows one edit
  // at seven characters and "Av."→"Avenida" is five. Like every other setting
  // here, this only takes effect on a full rebuild.
  synonyms: buildAddressSearchSynonyms(),
};

type ActiveFacilityProfiles = {
  verticalIds: Map<number, number[]>;
  territoryIds: Map<number, number[]>;
  repUserIds: Map<number, number[]>;
  funnelData: Map<number, FacilityProfileFunnelData[]>;
};

/** The row shape [facilityPages] selects, kept structural for testability. */
type FacilityPageRow = Parameters<typeof mapFacilitySearchDocument>[0];

/**
 * Joins a page of facility rows to its separately-loaded associations.
 *
 * Split out of [facilityPages] so it can be tested without a database. It was
 * inline, and a field could then be added to the document type and to the
 * index settings while the rebuild never populated it — which fails in the
 * worst direction available: the attribute is filterable, every document has
 * it empty, and matching facilities silently vanish from search results
 * instead of erroring.
 */
export function buildFacilityPageDocuments(
  rows: FacilityPageRow[],
  profiles: ActiveFacilityProfiles,
  clinicalFocusIds: Map<number, number[]>,
): FacilitySearchDocument[] {
  return rows
    .map((row) =>
      mapFacilitySearchDocument({
        ...row,
        verticalIds: profiles.verticalIds.get(row.id) ?? [],
        territoryIds: profiles.territoryIds.get(row.id) ?? [],
        repUserIds: profiles.repUserIds.get(row.id) ?? [],
        clinicalFocusIds: clinicalFocusIds.get(row.id) ?? [],
        profileFunnelData: profiles.funnelData.get(row.id) ?? [],
      }),
    )
    .filter((row): row is FacilitySearchDocument => row !== null);
}

/** One query per page, not per facility. */
async function loadClinicalFocusIds(
  facilityIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (facilityIds.length === 0) return map;

  const rows = await db
    .select({
      facilityId: facilityClinicalFocuses.facilityId,
      clinicalFocusId: facilityClinicalFocuses.clinicalFocusId,
    })
    .from(facilityClinicalFocuses)
    .where(inArray(facilityClinicalFocuses.facilityId, facilityIds));

  for (const row of rows) {
    const current = map.get(row.facilityId) ?? [];
    current.push(row.clinicalFocusId);
    map.set(row.facilityId, current);
  }
  return map;
}

async function loadActiveFacilityProfiles(facilityIds: number[]): Promise<ActiveFacilityProfiles> {
  const verticalIds = new Map<number, number[]>();
  const territoryIds = new Map<number, number[]>();
  const repUserIds = new Map<number, number[]>();
  const funnelData = new Map<number, FacilityProfileFunnelData[]>();
  if (facilityIds.length === 0) {
    return { verticalIds, territoryIds, repUserIds, funnelData };
  }

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

  const repRows = await db
    .select({
      facilityId: facilityVerticalProfiles.facilityId,
      userId: facilityVerticalRepAssignments.userId,
    })
    .from(facilityVerticalRepAssignments)
    .innerJoin(
      facilityVerticalProfiles,
      eq(facilityVerticalProfiles.id, facilityVerticalRepAssignments.facilityVerticalProfileId)
    )
    .where(
      and(
        inArray(facilityVerticalProfiles.facilityId, facilityIds),
        eq(facilityVerticalProfiles.isActive, true),
        isNull(facilityVerticalRepAssignments.endedAt)
      )
    );

  for (const row of repRows) {
    const current = repUserIds.get(row.facilityId) ?? [];
    if (!current.includes(row.userId)) {
      current.push(row.userId);
      repUserIds.set(row.facilityId, current);
    }
  }

  return { verticalIds, territoryIds, repUserIds, funnelData };
}
/** Q31 settings — keep in sync with PersonSearchDocument field list. */
export const PERSON_SETTINGS = {
  searchableAttributes: [
    "name",
    "socialName",
    "cpf",
    "specialty",
    "registrationDisplays",
  ],
  filterableAttributes: [
    "specialtyNormalized",
    "activeFacilityIds",
    "clinicalFacilityIds",
    "activeTerritoryIds",
  ],
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
        streetAddress: facilities.streetAddress,
        neighborhood: facilities.neighborhood,
        unitTypeId: facilities.unitTypeId,
        legalDocumentType: facilities.legalDocumentType,
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
    const facilityIds = rows.map((row) => row.id);
    const [profiles, clinicalFocusIds] = await Promise.all([
      loadActiveFacilityProfiles(facilityIds),
      loadClinicalFocusIds(facilityIds),
    ]);
    yield buildFacilityPageDocuments(rows, profiles, clinicalFocusIds);
  }
}

type PersonAssociation = {
  facilityId: number;
  territoryId: number | null;
  isClinical?: boolean;
};

async function loadActivePersonAssociations(
  personIds: number[]
): Promise<Map<number, PersonAssociation[]>> {
  if (personIds.length === 0) return new Map();

  const rows = await db
    .select({
      personId: personFacilities.personId,
      facilityId: personFacilities.facilityId,
      territoryId: facilityVerticalProfiles.managerZoneId,
      // Correlated rather than joined: joining the classification tables would
      // multiply the association rows, and every consumer here wants one row
      // per (person, facility, territory).
      isClinical: sql<boolean>`exists (
        select 1
        from person_facility_classification_assignments pfca
        join person_facility_classifications pfc
          on pfc.id = pfca.classification_id
        where pfca.person_facility_id = ${personFacilities.id}
          and pfc.code = 'HEALTHCARE_PROFESSIONAL'
      )`,
    })
    .from(personFacilities)
    .innerJoin(facilities, eq(personFacilities.facilityId, facilities.id))
    .leftJoin(
      facilityVerticalProfiles,
      and(
        eq(facilityVerticalProfiles.facilityId, facilities.id),
        eq(facilityVerticalProfiles.isActive, true)
      )
    )
    .where(and(
      inArray(personFacilities.personId, personIds),
      isNull(personFacilities.endedAt),
      isNull(facilities.deactivatedAt)
    ));

  return mergePersonAssociations(rows);
}

/**
 * Collapses association rows per person.
 *
 * Split from the query so the flag can be tested without a database. It carries
 * `isClinical` from the row into the document, and dropping that one line makes
 * `clinicalFacilityIds` empty on every document — at which point the
 * associate-doctors exclusion matches nobody, and the only symptom is that the
 * search path quietly falls back to SQL for every request.
 */
export function mergePersonAssociations(
  rows: Array<{
    personId: number;
    facilityId: number;
    territoryId: number | null;
    isClinical: boolean;
  }>
): Map<number, PersonAssociation[]> {
  const associations = new Map<number, PersonAssociation[]>();
  for (const row of rows) {
    const current = associations.get(row.personId) ?? [];
    const already = current.find(
      (entry) => entry.facilityId === row.facilityId && entry.territoryId === row.territoryId
    );
    if (already) {
      // Someone can hold more than one link to the same clinic — an
      // administrative one and a clinical one. Dropping the duplicate must not
      // drop the clinical flag with it, so it is OR-ed rather than overwritten;
      // otherwise whether they count as a doctor there depends on row order.
      already.isClinical = already.isClinical || row.isClinical;
      continue;
    }
    current.push({
      facilityId: row.facilityId,
      territoryId: row.territoryId,
      isClinical: row.isClinical,
    });
    associations.set(row.personId, current);
  }
  return associations;
}

async function loadPrimarySpecialtyLabels(
  personIds: number[]
): Promise<Map<number, string | null>> {
  const map = new Map<number, string | null>();
  if (personIds.length === 0) return map;

  const rows = await db
    .select({
      personId: personHealthcareProfileSpecialties.personId,
      specialtyName: healthcareSpecialties.name,
    })
    .from(personHealthcareProfileSpecialties)
    .innerJoin(
      healthcareSpecialties,
      eq(healthcareSpecialties.id, personHealthcareProfileSpecialties.specialtyId)
    )
    .where(and(
      inArray(personHealthcareProfileSpecialties.personId, personIds),
      eq(personHealthcareProfileSpecialties.isPrimary, true)
    ));

  for (const id of personIds) map.set(id, null);
  for (const row of rows) map.set(row.personId, row.specialtyName);
  return map;
}

async function loadActiveRegistrationDisplays(
  personIds: number[]
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (personIds.length === 0) return map;

  for (const id of personIds) map.set(id, []);

  const rows = await db
    .select({
      personId: personProfessionalRegistrations.personId,
      councilAbbreviation: personProfessionalRegistrationCouncils.abbreviation,
      stateCode: personProfessionalRegistrations.stateCode,
      registrationNumber: personProfessionalRegistrations.registrationNumber,
      isPrimary: personProfessionalRegistrations.isPrimary,
    })
    .from(personProfessionalRegistrations)
    .innerJoin(
      personProfessionalRegistrationCouncils,
      eq(
        personProfessionalRegistrations.councilId,
        personProfessionalRegistrationCouncils.id
      )
    )
    .where(
      and(
        inArray(personProfessionalRegistrations.personId, personIds),
        eq(personProfessionalRegistrations.isActive, true)
      )
    );

  rows.sort((left, right) => {
    if (left.personId !== right.personId) return left.personId - right.personId;
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    const byAbbrev = left.councilAbbreviation.localeCompare(
      right.councilAbbreviation,
      "pt-BR"
    );
    if (byAbbrev !== 0) return byAbbrev;
    const byState = left.stateCode.localeCompare(right.stateCode, "pt-BR");
    if (byState !== 0) return byState;
    return left.registrationNumber.localeCompare(
      right.registrationNumber,
      "pt-BR"
    );
  });

  for (const row of rows) {
    const list = map.get(row.personId) ?? [];
    list.push(
      formatRegistrationDisplay({
        councilAbbreviation: row.councilAbbreviation,
        stateCode: row.stateCode,
        registrationNumber: row.registrationNumber,
      })
    );
    map.set(row.personId, list);
  }

  return map;
}

/** Persons with healthcare profiles only (D16 / Q31). */
async function* personPages(): AsyncGenerator<PersonSearchDocument[]> {
  let lastId: number | undefined;

  while (true) {
    const rows = await db
      .select({
        id: persons.id,
        firstName: persons.firstName,
        lastName: persons.lastName,
        socialName: persons.socialName,
        cpf: persons.cpf,
        deletedAt: persons.deletedAt,
      })
      .from(persons)
      .innerJoin(
        personHealthcareProfiles,
        eq(personHealthcareProfiles.personId, persons.id)
      )
      .where(and(isNull(persons.deletedAt), lastId ? gt(persons.id, lastId) : undefined))
      .orderBy(asc(persons.id))
      .limit(PAGE_SIZE);
    if (rows.length === 0) return;

    lastId = rows.at(-1)!.id;
    const personIds = rows.map((row) => row.id);
    const [associations, specialties, registrationDisplays] = await Promise.all([
      loadActivePersonAssociations(personIds),
      loadPrimarySpecialtyLabels(personIds),
      loadActiveRegistrationDisplays(personIds),
    ]);

    yield rows
      .map((row) =>
        mapPersonSearchDocument({
          ...row,
          primarySpecialtyLabel: specialties.get(row.id) ?? null,
          activeAssociations: associations.get(row.id) ?? [],
          registrationDisplays: registrationDisplays.get(row.id) ?? [],
        })
      )
      .filter((row): row is PersonSearchDocument => row !== null);
  }
}

function settingsFor(target: SearchSyncTarget): Record<string, unknown> {
  if (target === "facilities") return FACILITY_SETTINGS;
  if (target === "persons") return PERSON_SETTINGS;
  return FACILITY_CANDIDATE_SETTINGS;
}

function pagesFor(target: SearchSyncTarget) {
  if (target === "facilities") return facilityPages();
  if (target === "persons") return personPages();
  return facilityCandidatePages();
}

export async function rebuildFullSearchIndex(target: SearchSyncTarget): Promise<void> {
  const temporaryIndex = `${target}__rebuild_${crypto.randomUUID().replaceAll("-", "")}`;

  await rebuildSearchIndex({
    target,
    temporaryIndex,
    search: createSearchClient(),
    settings: settingsFor(target),
    pages: pagesFor(target),
  });
}
