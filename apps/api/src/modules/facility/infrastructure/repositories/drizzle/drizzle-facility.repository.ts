import {
  facilities,
  facilityVerticalRepAssignments,
  clinicalFocuses,
  facilityClinicalFocuses,
  facilityVerticalProfiles,
  businessVerticals,
  territories,
  users,
  visits,
  orders,
  orderItems,
  municipalities,
  states,
} from "@atlasmed/database";
import { eq, and, isNull, ilike, inArray, sql, asc, desc, gte, lte, or, getTableColumns, type SQL } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { ResourceNotFoundError, ValidationError } from "../../../../../shared/errors";
import {
  purchaseBucketToFunnelFilter,
  type FacilityPurchaseBucket,
} from "../../../application/list-facilities-query";
import type {
  FacilityClinicalFocus,
  FacilityCommercialStatus,
  FacilityListRecord,
  FacilityListScopeFilter,
  FacilityMapPoint,
  FacilityPurchaseFunnelStage,
  FacilityRecord,
  FacilityRepository,
  FacilityVerticalProfileRecord,
} from "../../../application/interfaces/facility.repository.interface";
import { normalizeLegalDocument } from "../../../application/utils/facility-tax-id.utils";
type FacilityRow = typeof facilities.$inferSelect;

/** Row shape after JOIN municipalities/states for display city + UF. */
type FacilityRowWithCoords = FacilityRow & {
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

const locationLatSql = sql<number | null>`ST_Y(${facilities.location}::geometry)`;
const locationLngSql = sql<number | null>`ST_X(${facilities.location}::geometry)`;

const facilityGeoSelect = {
  ...getTableColumns(facilities),
  city: municipalities.name,
  state: states.abbreviation,
  lat: locationLatSql,
  lng: locationLngSql,
};

function locationPointSql(lat: number, lng: number) {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

function deriveProfileTerritoryId(
  profiles: Array<{ territoryId?: number | null }>,
): number | null {
  const ids = [
    ...new Set(
      profiles
        .map((p) => p.territoryId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  ];
  if (ids.length === 1) return ids[0]!;
  return null;
}

/** Facility-level membership: any active profile with a zone ⇒ assigned. */
function deriveTerritoryAssignmentStatus(
  profiles?: Array<{ isActive: boolean; territoryId?: number | null }>,
): "assigned" | "unassigned" {
  if (!profiles?.length) return "unassigned";
  const hasZone = profiles.some(
    (p) => p.isActive && typeof p.territoryId === "number" && p.territoryId > 0,
  );
  return hasZone ? "assigned" : "unassigned";
}

export function mapFacility(
  facility: FacilityRowWithCoords | FacilityRow,
  options: {
    lat?: number | null;
    lng?: number | null;
    city?: string | null;
    state?: string | null;
    clinicalFocuses?: FacilityClinicalFocus[];
    consultantName?: string | null;
    consultantSince?: Date | null;
    managerName?: string | null;
    territoryId?: number | null;
    territoryName?: string | null;
    commercialStatus?: FacilityCommercialStatus | null;
    verticalProfiles?: FacilityVerticalProfileRecord[];
  } = {}
): FacilityRecord {
  const withCoords = facility as FacilityRowWithCoords;
  return {
    id: facility.id,
    name: facility.displayName,
    neighborhood: facility.neighborhood,
    city: options.city !== undefined ? options.city : (withCoords.city ?? null),
    state: options.state !== undefined ? options.state : (withCoords.state ?? null),
    streetAddress: facility.streetAddress,
    streetNumber: facility.streetNumber,
    addressComplement: facility.addressComplement,
    postalCode: facility.postalCode,
    stateId: facility.stateId,
    municipalityId: facility.municipalityId,
    phone: facility.phoneNumber,
    whatsapp: facility.whatsappNumber,
    email: facility.email,
    website: facility.websiteUrl,
    billingEmail: facility.billingEmail ?? null,
    responsibleName: facility.responsibleName,
    openingHours: facility.openingHours,
    legalDocumentType: facility.legalDocumentType ?? "CNPJ",
    legalDocument: facility.legalDocument,
    lat: options.lat !== undefined ? options.lat : (withCoords.lat ?? null),
    lng: options.lng !== undefined ? options.lng : (withCoords.lng ?? null),
    territoryId:
      options.territoryId !== undefined
        ? options.territoryId
        : options.verticalProfiles
          ? deriveProfileTerritoryId(options.verticalProfiles)
          : null,
    territoryName: options.territoryName ?? null,
    territoryAssignmentStatus: deriveTerritoryAssignmentStatus(options.verticalProfiles),
    commercialStatus: options.commercialStatus ?? null,
    consultantName: options.consultantName ?? null,
    consultantSince: options.consultantSince ?? null,
    managerName: options.managerName ?? null,
    imageUrl: facility.imageUrl ?? null,
    imageBlurhash: facility.imageBlurhash ?? null,
    cnesCode: facility.cnesCode ?? null,
    unitTypeId: facility.unitTypeId ?? null,
    unitSubtypeId: facility.unitSubtypeId ?? null,
    deactivatedAt: facility.deactivatedAt,
    createdAt: facility.createdAt,
    updatedAt: facility.updatedAt,
    clinicalFocuses: options.clinicalFocuses ?? [],
    verticalProfiles: options.verticalProfiles,
  };
}

function buildScopeCondition(scope: FacilityListScopeFilter) {
  const conditions = [];
  if (!scope.isGlobal) {
    const ids = scope.facilityIds?.length ? scope.facilityIds : [-1];
    conditions.push(inArray(facilities.id, ids));
  }
  if (scope.restrictToVerticalProfiles && scope.verticalIds && scope.verticalIds.length > 0) {
    conditions.push(
      inArray(
        facilities.id,
        db
          .select({ facilityId: facilityVerticalProfiles.facilityId })
          .from(facilityVerticalProfiles)
          .where(
            and(
              inArray(facilityVerticalProfiles.verticalId, scope.verticalIds),
              eq(facilityVerticalProfiles.isActive, true),
            ),
          ),
      ),
    );
  }
  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0]!;
  return and(...conditions);
}

async function loadVerticalProfiles(
  facilityIds: number[],
  verticalIds?: number[],
): Promise<Map<number, FacilityVerticalProfileRecord[]>> {
  if (facilityIds.length === 0) return new Map();

  const profileConditions = [inArray(facilityVerticalProfiles.facilityId, facilityIds)];
  if (verticalIds && verticalIds.length > 0) {
    profileConditions.push(inArray(facilityVerticalProfiles.verticalId, verticalIds));
  }

  const rows = await db
    .select({
      id: facilityVerticalProfiles.id,
      facilityId: facilityVerticalProfiles.facilityId,
      verticalId: facilityVerticalProfiles.verticalId,
      verticalCode: businessVerticals.code,
      verticalName: businessVerticals.name,
      isActive: facilityVerticalProfiles.isActive,
      commercialStatus: facilityVerticalProfiles.conformityStatus,
      territoryId: facilityVerticalProfiles.managerZoneId,
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
      purchaseFunnelStage: facilityVerticalProfiles.purchaseFunnelStage,
      nextPurchaseFunnelTransitionDate:
        facilityVerticalProfiles.nextPurchaseFunnelTransitionDate,
    })
    .from(facilityVerticalProfiles)
    .innerJoin(businessVerticals, eq(facilityVerticalProfiles.verticalId, businessVerticals.id))
    .where(and(...profileConditions));

  const map = new Map<number, FacilityVerticalProfileRecord[]>();
  for (const row of rows) {
    const list = map.get(row.facilityId) ?? [];
    list.push({
      id: row.id,
      verticalId: row.verticalId,
      verticalCode: row.verticalCode,
      verticalName: row.verticalName,
      isActive: row.isActive,
      commercialStatus: row.commercialStatus,
      territoryId: row.territoryId,
      purchaseRecurrence: {
        observedPurchaseIntervalDays: row.observedPurchaseIntervalDays,
        purchaseIntervalDays: row.purchaseIntervalDays,
        purchaseIntervalSource: row.purchaseIntervalSource,
        manualPurchaseProfile: row.manualPurchaseProfile,
        manualPurchaseIntervalDays: row.manualPurchaseIntervalDays,
        lastValidPurchaseDate: row.lastValidPurchaseDate,
        purchaseRecurrenceSampleSize: row.purchaseRecurrenceSampleSize,
        purchaseFunnelStage: row.purchaseFunnelStage,
        nextPurchaseFunnelTransitionDate: row.nextPurchaseFunnelTransitionDate,
      },
    });
    map.set(row.facilityId, list);
  }
  return map;
}

function activeProfileMatchCondition(
  verticalIds: number[] | undefined,
  extraConditions: SQL[],
) {
  const profileConditions = [
    eq(facilityVerticalProfiles.isActive, true),
    ...extraConditions,
  ];
  if (verticalIds && verticalIds.length > 0) {
    profileConditions.push(inArray(facilityVerticalProfiles.verticalId, verticalIds));
  }
  return inArray(
    facilities.id,
    db
      .select({ facilityId: facilityVerticalProfiles.facilityId })
      .from(facilityVerticalProfiles)
      .where(and(...profileConditions)),
  );
}

function deriveProfileCommercialFields(
  profiles: FacilityVerticalProfileRecord[],
): Pick<FacilityRecord, "commercialStatus"> {
  if (profiles.length === 1) {
    return { commercialStatus: profiles[0]!.commercialStatus };
  }
  return { commercialStatus: null };
}

type ConsultantInfo = {
  name: string | null;
  since: Date | null;
  managerName: string | null;
};

function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string | null {
  const name = [firstName, lastName].filter(Boolean).join(" ");
  return name.length > 0 ? name : null;
}

async function loadConsultantInfo(
  facilityIds: number[],
  verticalIds?: number[],
): Promise<Map<number, ConsultantInfo>> {
  if (facilityIds.length === 0) return new Map();

  const assignConditions = [
    inArray(facilityVerticalProfiles.facilityId, facilityIds),
    eq(facilityVerticalProfiles.isActive, true),
    isNull(facilityVerticalRepAssignments.endedAt),
  ];
  if (verticalIds && verticalIds.length > 0) {
    assignConditions.push(
      inArray(facilityVerticalProfiles.verticalId, verticalIds),
    );
  }

  // Flat list DTO has one consultantName: when scope has a single verticalId the
  // join is exact; when multi-vertical, pick lowest verticalId (stable, not
  // "most recently touched"). Prefer single-vertical scope for accurate display.
  const consultantRows = await db
    .select({
      facilityId: facilityVerticalProfiles.facilityId,
      firstName: users.firstName,
      lastName: users.lastName,
      startedAt: facilityVerticalRepAssignments.startedAt,
      verticalId: facilityVerticalProfiles.verticalId,
    })
    .from(facilityVerticalRepAssignments)
    .innerJoin(
      facilityVerticalProfiles,
      eq(
        facilityVerticalProfiles.id,
        facilityVerticalRepAssignments.facilityVerticalProfileId,
      ),
    )
    .innerJoin(users, eq(users.id, facilityVerticalRepAssignments.userId))
    .where(and(...assignConditions))
    .orderBy(asc(facilityVerticalProfiles.verticalId));

  // Spec 0006: clinic gerente = zone UTA on manager_zone_id (not users.manager_id).
  const zoneManagerRows = await db.execute(sql`
    SELECT DISTINCT ON (fvp.facility_id)
      fvp.facility_id AS facility_id,
      mgr.first_name AS first_name,
      mgr.last_name AS last_name
    FROM facility_vertical_profiles fvp
    INNER JOIN user_territory_assignments uta
      ON uta.territory_id = fvp.manager_zone_id
    INNER JOIN users mgr ON mgr.id = uta.user_id
    WHERE fvp.facility_id IN (${sql.join(
      facilityIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      AND fvp.is_active = true
      AND fvp.manager_zone_id IS NOT NULL
      AND mgr.deleted_at IS NULL
    ORDER BY fvp.facility_id, fvp.updated_at DESC
  `) as Array<{
    facility_id: number;
    first_name: string | null;
    last_name: string | null;
  }>;

  const zoneManagerNameByFacility = new Map<number, string | null>();
  for (const row of zoneManagerRows) {
    zoneManagerNameByFacility.set(
      row.facility_id,
      displayName(row.first_name, row.last_name),
    );
  }

  const consultantByFacility = new Map<number, ConsultantInfo>();
  for (const row of consultantRows) {
    if (consultantByFacility.has(row.facilityId)) continue;
    consultantByFacility.set(row.facilityId, {
      name: displayName(row.firstName, row.lastName),
      since: row.startedAt ?? null,
      managerName: zoneManagerNameByFacility.get(row.facilityId) ?? null,
    });
  }

  for (const facilityId of facilityIds) {
    if (consultantByFacility.has(facilityId)) continue;
    consultantByFacility.set(facilityId, {
      name: null,
      since: null,
      managerName: zoneManagerNameByFacility.get(facilityId) ?? null,
    });
  }

  return consultantByFacility;
}

async function loadTerritoryNames(
  territoryIds: Array<number | null | undefined>
): Promise<Map<number, string>> {
  const ids = [
    ...new Set(
      territoryIds.filter(
        (id): id is number => typeof id === "number" && id > 0
      )
    ),
  ];
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({ id: territories.id, name: territories.name })
    .from(territories)
    .where(inArray(territories.id, ids));

  return new Map(rows.map((row) => [row.id, row.name]));
}

async function loadLastVisitAt(
  facilityIds: number[],
  userId: number,
): Promise<Map<number, Date>> {
  if (facilityIds.length === 0) return new Map();

  const rows = await db
    .select({
      facilityId: visits.facilityId,
      lastVisitAt: sql<Date>`max(${visits.visitedAt})`,
    })
    .from(visits)
    .where(
      and(
        inArray(visits.facilityId, facilityIds),
        eq(visits.userId, userId),
      ),
    )
    .groupBy(visits.facilityId);

  return new Map(rows.map((row) => [row.facilityId, row.lastVisitAt]));
}

/** Batch-load clinical focuses, alphabetical for UI chips. */
async function loadClinicalFocusesByFacilityIds(
  facilityIds: number[],
): Promise<Map<number, FacilityClinicalFocus[]>> {
  const result = new Map<number, FacilityClinicalFocus[]>();
  if (facilityIds.length === 0) return result;

  const rows = await db
    .select({
      facilityId: facilityClinicalFocuses.facilityId,
      id: clinicalFocuses.id,
      name: clinicalFocuses.name,
      cnesCode: clinicalFocuses.cnesCode,
    })
    .from(facilityClinicalFocuses)
    .innerJoin(
      clinicalFocuses,
      eq(clinicalFocuses.id, facilityClinicalFocuses.clinicalFocusId),
    )
    .where(inArray(facilityClinicalFocuses.facilityId, facilityIds));

  for (const row of rows) {
    const list = result.get(row.facilityId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      cnesCode: row.cnesCode,
    });
    result.set(row.facilityId, list);
  }

  for (const [facilityId, list] of result) {
    list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    result.set(facilityId, list);
  }
  return result;
}


export function buildFacilityListConditions(params: {
  scope: FacilityListScopeFilter;
  search?: string;
  commercialStatus?: FacilityCommercialStatus;
  purchaseBucket?: FacilityPurchaseBucket;
  productIds?: number[];
  clinicalFocusIds?: number[];
  purchaseFunnelStages?: FacilityPurchaseFunnelStage[];
  purchaseProfile?: "AUTOMATIC" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";
  purchaseIntervalMinDays?: number;
  purchaseIntervalMaxDays?: number;
  candidateIds?: number[];
}) {
  const conditions = [isNull(facilities.deactivatedAt)];
  const scopeCondition = buildScopeCondition(params.scope);
  if (scopeCondition) conditions.push(scopeCondition);
  if (params.candidateIds) conditions.push(inArray(facilities.id, params.candidateIds));
  if (params.search) {
    const pattern = `%${params.search}%`;
    conditions.push(or(
      ilike(facilities.displayName, pattern), ilike(facilities.legalName, pattern),
      ilike(facilities.tradeName, pattern), ilike(facilities.legalDocument, pattern),
      ilike(facilities.cnesCode, pattern),
      ilike(facilities.streetAddress, pattern),
      ilike(facilities.neighborhood, pattern),
      inArray(
        facilities.municipalityId,
        db
          .select({ id: municipalities.id })
          .from(municipalities)
          .where(ilike(municipalities.name, pattern)),
      ),
      inArray(
        facilities.stateId,
        db
          .select({ id: states.id })
          .from(states)
          .where(
            or(ilike(states.abbreviation, pattern), ilike(states.name, pattern)),
          ),
      ),
    )!);
  }
  if (params.commercialStatus) {
    conditions.push(inArray(facilities.id, db.select({ facilityId: facilityVerticalProfiles.facilityId })
      .from(facilityVerticalProfiles).where(and(
        eq(facilityVerticalProfiles.conformityStatus, params.commercialStatus),
        eq(facilityVerticalProfiles.isActive, true),
        ...(params.scope.verticalIds?.length ? [inArray(facilityVerticalProfiles.verticalId, params.scope.verticalIds)] : []),
      ))));
  }
  if (params.purchaseBucket) {
    const bucket = purchaseBucketToFunnelFilter(params.purchaseBucket);
    const verticalIds = params.scope.verticalIds;
    const stageCond = bucket.includeNull
      ? or(
          inArray(facilityVerticalProfiles.purchaseFunnelStage, bucket.stages),
          isNull(facilityVerticalProfiles.purchaseFunnelStage),
        )!
      : inArray(facilityVerticalProfiles.purchaseFunnelStage, bucket.stages);
    conditions.push(activeProfileMatchCondition(verticalIds, [stageCond]));
  }
  // Orders reach the facility through the profile since spec 0010 §4.
  if (params.productIds?.length) conditions.push(inArray(facilities.id,
    db.select({ facilityId: facilityVerticalProfiles.facilityId })
      .from(orders)
      .innerJoin(
        facilityVerticalProfiles,
        eq(facilityVerticalProfiles.id, orders.facilityVerticalProfileId),
      )
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(inArray(orderItems.productId, params.productIds))));
  if (params.clinicalFocusIds?.length) {
    // AND: clinic must offer every selected clinical focus.
    const ids = [...new Set(params.clinicalFocusIds)];
    conditions.push(
      inArray(
        facilities.id,
        db
          .select({ facilityId: facilityClinicalFocuses.facilityId })
          .from(facilityClinicalFocuses)
          .where(inArray(facilityClinicalFocuses.clinicalFocusId, ids))
          .groupBy(facilityClinicalFocuses.facilityId)
          .having(
            sql`count(distinct ${facilityClinicalFocuses.clinicalFocusId}) = ${ids.length}`,
          ),
      ),
    );
  }
  if (params.purchaseFunnelStages?.length) {
    conditions.push(
      activeProfileMatchCondition(params.scope.verticalIds, [
        inArray(
          facilityVerticalProfiles.purchaseFunnelStage,
          params.purchaseFunnelStages,
        ),
      ]),
    );
  }
  if (params.purchaseProfile === "AUTOMATIC") {
    conditions.push(
      activeProfileMatchCondition(params.scope.verticalIds, [
        isNull(facilityVerticalProfiles.manualPurchaseProfile),
      ]),
    );
  } else if (params.purchaseProfile) {
    conditions.push(
      activeProfileMatchCondition(params.scope.verticalIds, [
        eq(
          facilityVerticalProfiles.manualPurchaseProfile,
          params.purchaseProfile,
        ),
      ]),
    );
  }
  if (params.purchaseIntervalMinDays !== undefined) {
    conditions.push(
      activeProfileMatchCondition(params.scope.verticalIds, [
        gte(
          facilityVerticalProfiles.purchaseIntervalDays,
          params.purchaseIntervalMinDays,
        ),
      ]),
    );
  }
  if (params.purchaseIntervalMaxDays !== undefined) {
    conditions.push(
      activeProfileMatchCondition(params.scope.verticalIds, [
        lte(
          facilityVerticalProfiles.purchaseIntervalDays,
          params.purchaseIntervalMaxDays,
        ),
      ]),
    );
  }
  return and(...conditions);
}

const profileFunnelStageRankSql = sql<number>`case p.purchase_funnel_stage
  when 'NEVER_PURCHASED' then 0 when 'OUTSIDE_WINDOW' then 1
  when 'PURCHASE_WINDOW' then 2 when 'CHURN' then 3 when 'INACTIVE' then 4 end`;

function profileVerticalFilterSql(verticalIds?: number[]) {
  return verticalIds && verticalIds.length > 0
    ? sql`and p.vertical_id in (${sql.join(
        verticalIds.map((id) => sql`${id}`),
        sql`, `,
      )})`
    : sql``;
}

function profileFunnelStageRankSubquery(verticalIds?: number[]) {
  return sql<number>`(
    select coalesce(max(${profileFunnelStageRankSql}), 0)
    from ${facilityVerticalProfiles} p
    where p.facility_id = ${facilities.id}
      and p.is_active = true
      ${profileVerticalFilterSql(verticalIds)}
  )`;
}

function profileMinIntervalDaysSubquery(verticalIds?: number[]) {
  return sql<number>`(
    select coalesce(min(p.purchase_interval_days), 30)
    from ${facilityVerticalProfiles} p
    where p.facility_id = ${facilities.id}
      and p.is_active = true
      ${profileVerticalFilterSql(verticalIds)}
  )`;
}

function profileMaxLastPurchaseSubquery(verticalIds?: number[]) {
  return sql<string | null>`(
    select max(p.last_valid_purchase_date)
    from ${facilityVerticalProfiles} p
    where p.facility_id = ${facilities.id}
      and p.is_active = true
      ${profileVerticalFilterSql(verticalIds)}
  )`;
}

export function buildFacilityListOrderBy(params: {
  sort?: "relevance" | "distance" | "name" | "purchaseFunnelStage" | "purchaseIntervalDays" | "lastPurchaseDate";
  order?: "asc" | "desc";
  verticalIds?: number[];
}) {
  const direction = params.order === "desc" ? desc : asc;
  switch (params.sort) {
    case "purchaseFunnelStage":
      return [
        direction(profileFunnelStageRankSubquery(params.verticalIds)),
        asc(facilities.displayName),
        asc(facilities.id),
      ];
    case "purchaseIntervalDays":
      return [
        direction(profileMinIntervalDaysSubquery(params.verticalIds)),
        asc(facilities.displayName),
        asc(facilities.id),
      ];
    case "lastPurchaseDate":
      return [
        sql`${profileMaxLastPurchaseSubquery(params.verticalIds)} is null`,
        params.order === "desc"
          ? desc(profileMaxLastPurchaseSubquery(params.verticalIds))
          : asc(profileMaxLastPurchaseSubquery(params.verticalIds)),
        asc(facilities.displayName),
        asc(facilities.id),
      ];
    // Explicit, and honouring `order`. The default branch below returns
    // ascending regardless, so "Nome Z–A" could not have worked through it.
    case "name":
      return [direction(facilities.displayName), asc(facilities.id)];
    default: return [asc(facilities.displayName), asc(facilities.id)];
  }
}

export class DrizzleFacilityRepository implements FacilityRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: "UNREGISTERED" | "REGISTERED" | "SUSPENDED" | "CLOSED";
    purchaseBucket?: FacilityPurchaseBucket;
    productIds?: number[];
    clinicalFocusIds?: number[];
    purchaseFunnelStages?: FacilityPurchaseFunnelStage[];
    purchaseProfile?: "AUTOMATIC" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";
    purchaseIntervalMinDays?: number;
    purchaseIntervalMaxDays?: number;
    sort?: "relevance" | "distance" | "name" | "purchaseFunnelStage" | "purchaseIntervalDays" | "lastPurchaseDate";
    order?: "asc" | "desc";
    userId: number;
    scope: FacilityListScopeFilter;
    candidateIds?: number[];
  }): Promise<{ facilities: FacilityListRecord[]; total: number }> {
    const referencePoint =
      params.latitude === undefined
        ? undefined
        : sql`ST_SetSRID(ST_MakePoint(${params.longitude!}, ${params.latitude}), 4326)`;
    const distanceKm = referencePoint
      ? sql<number>`ST_Distance(${facilities.location}::geography, ${referencePoint}::geography) / 1000`
      : undefined;
    const where = and(
      buildFacilityListConditions(params),
      ...(referencePoint
        ? [
            sql`${facilities.location} IS NOT NULL`,
            ...(params.radiusKm !== undefined
              ? [sql`ST_DWithin(${facilities.location}::geography, ${referencePoint}::geography, ${params.radiusKm * 1000})`]
              : []),
          ]
        : []),
    );

    const skip = (params.page - 1) * params.limit;

    // Sorts the caller asked for explicitly. Distance is the default ordering
    // when coordinates are present, but it must not override a choice the rep
    // made: `name` was missing from this list, so picking "Nome A–Z" or
    // "Nome Z–A" on Explorar returned a distance-ordered list while the sheet
    // showed the name option selected. The client sends coordinates on every
    // request regardless of sort, so this was every request with GPS on.
    // Verified against production on 2026-08-13 before fixing.
    //
    // The doctors list already excludes `name` from its equivalent check.
    const isSpecificSort = params.sort === "purchaseFunnelStage"
      || params.sort === "purchaseIntervalDays"
      || params.sort === "lastPurchaseDate"
      || params.sort === "name";

    const [rows, countRows] = await Promise.all([
      db
        .select({
          ...facilityGeoSelect,
          distanceKm: distanceKm ?? sql<number | null>`null`,
        })
        .from(facilities)
        .innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
        .innerJoin(states, eq(states.id, facilities.stateId))
        .where(where)
        .orderBy(
          ...(distanceKm && !isSpecificSort
            ? [asc(distanceKm), asc(facilities.displayName), asc(facilities.id)]
            : buildFacilityListOrderBy({
                sort: params.sort,
                order: params.order,
                verticalIds: params.scope.verticalIds,
              }))
        )
        .offset(skip)
        .limit(params.limit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(facilities)
        .where(where),
    ]);

    if (rows.length === 0) {
      return { facilities: [], total: countRows[0]?.count ?? 0 };
    }

    const ids = rows.map((r) => r.id);

    // Only territory names need the profiles — they are keyed by the territory
    // each profile derives. Consultants, last visit and clinical focuses are
    // keyed by facility id, which is known before any of this runs, so waiting
    // for profiles bought them nothing and cost a round trip on every page of
    // the app's most-used screen.
    const [
      profilesByFacility,
      consultantMap,
      lastVisitAtByFacility,
      clinicalFocusesByFacility,
    ] = await Promise.all([
      loadVerticalProfiles(ids, params.scope.verticalIds),
      loadConsultantInfo(ids, params.scope.verticalIds),
      loadLastVisitAt(ids, params.userId),
      loadClinicalFocusesByFacilityIds(ids),
    ]);

    const derivedTerritoryIds = ids.map((id) =>
      deriveProfileTerritoryId(profilesByFacility.get(id) ?? []),
    );
    const territoryNameById = await loadTerritoryNames(derivedTerritoryIds);

    const countMap = new Map<number, number>();

    return {
      facilities: rows.map((row) => {
        const consultant = consultantMap.get(row.id);
        const profiles = profilesByFacility.get(row.id) ?? [];
        const derived = deriveProfileCommercialFields(profiles);
        const territoryId = deriveProfileTerritoryId(profiles);
        return {
          ...mapFacility(row, {
            lat: row.lat,
            lng: row.lng,
            clinicalFocuses: clinicalFocusesByFacility.get(row.id) ?? [],
            consultantName: consultant?.name ?? null,
            consultantSince: consultant?.since ?? null,
            managerName: consultant?.managerName ?? null,
            territoryId,
            territoryName: territoryId
              ? (territoryNameById.get(territoryId) ?? null)
              : null,
            commercialStatus: derived.commercialStatus,
            verticalProfiles: profiles,
          }),
          distanceKm: row.distanceKm ?? null,
          professionalCount: countMap.get(row.id) ?? 0,
          lastVisitAt: lastVisitAtByFacility.get(row.id) ?? null,
        };
      }),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findAllByIds(params: {
    ids: number[];
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: "UNREGISTERED" | "REGISTERED" | "SUSPENDED" | "CLOSED";
    purchaseBucket?: FacilityPurchaseBucket;
    productIds?: number[];
    clinicalFocusIds?: number[];
    purchaseFunnelStages?: FacilityPurchaseFunnelStage[];
    purchaseProfile?: "AUTOMATIC" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";
    purchaseIntervalMinDays?: number;
    purchaseIntervalMaxDays?: number;
    sort?: "relevance" | "distance" | "name" | "purchaseFunnelStage" | "purchaseIntervalDays" | "lastPurchaseDate";
    order?: "asc" | "desc";
    userId: number;
    scope: FacilityListScopeFilter;
  }): Promise<FacilityListRecord[]> {
    if (params.ids.length === 0) {
      return [];
    }

    const { facilities: rows } = await this.findAll({
      ...params,
      page: 1,
      limit: params.ids.length,
      candidateIds: params.ids,
    });
    return rows;
  }

  async listClinicalFocusCatalog(): Promise<FacilityClinicalFocus[]> {
    const rows = await db
      .select({
        id: clinicalFocuses.id,
        name: clinicalFocuses.name,
        cnesCode: clinicalFocuses.cnesCode,
      })
      .from(clinicalFocuses)
      .where(eq(clinicalFocuses.isActive, true))
      .orderBy(asc(clinicalFocuses.name));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      cnesCode: row.cnesCode,
    }));
  }

  async findById(id: number): Promise<FacilityRecord | null> {
    const [facility] = await db
      .select(facilityGeoSelect)
      .from(facilities)
      .innerJoin(municipalities, eq(municipalities.id, facilities.municipalityId))
      .innerJoin(states, eq(states.id, facilities.stateId))
      .where(and(eq(facilities.id, id), isNull(facilities.deactivatedAt)))
      .limit(1);

    if (!facility) return null;

    const profilesByFacility = await loadVerticalProfiles([id]);
    const profiles = profilesByFacility.get(id) ?? [];
    const territoryId = deriveProfileTerritoryId(profiles);

    const [clinicalFocusesByFacility, consultantMap, territoryNameById] =
      await Promise.all([
        loadClinicalFocusesByFacilityIds([id]),
        loadConsultantInfo([id]),
        loadTerritoryNames([territoryId]),
      ]);

    const consultant = consultantMap.get(id);
    const derived = deriveProfileCommercialFields(profiles);
    return mapFacility(facility, {
      lat: facility.lat,
      lng: facility.lng,
      clinicalFocuses: clinicalFocusesByFacility.get(id) ?? [],
      consultantName: consultant?.name ?? null,
      consultantSince: consultant?.since ?? null,
      managerName: consultant?.managerName ?? null,
      territoryId,
      territoryName: territoryId
        ? (territoryNameById.get(territoryId) ?? null)
        : null,
      commercialStatus: derived.commercialStatus,
      verticalProfiles: profiles,
    });
  }

  async create(data: {
    name: string;
    stateId: number;
    municipalityId: number;
    legalDocumentType: "CNPJ" | "CPF";
    legalDocument?: string | null;
    lat?: number | null;
    lng?: number | null;
    verticalId: number;
  }): Promise<FacilityRecord> {
    const [mun] = await db
      .select({ id: municipalities.id, stateId: municipalities.stateId })
      .from(municipalities)
      .where(eq(municipalities.id, data.municipalityId))
      .limit(1);
    if (!mun) {
      throw new ValidationError([
        { field: "municipalityId", message: "Municipality not found" },
      ]);
    }
    if (mun.stateId !== data.stateId) {
      throw new ValidationError([
        {
          field: "municipalityId",
          message: "Municipality does not belong to the given state",
        },
      ]);
    }

    // Spec 0009 R5: `facilities.location` is NOT NULL, so a create without a
    // position is rejected here rather than by Postgres — the caller gets a
    // field-level validation error instead of a constraint violation.
    if (data.lat == null || data.lng == null) {
      throw new ValidationError([
        { field: "lat", message: "Clinic coordinates are required" },
      ]);
    }
    // Captured before the transaction: narrowing of a property does not survive
    // into the callback below.
    const { lat, lng } = { lat: data.lat, lng: data.lng };

    // Facility + first vertical profile are one unit: a facility without a
    // profile is invisible to every non-global scope (spec 0010 §1.2/§1.7).
    // ensureVerticalProfile is not reused here — it closes over the `db`
    // singleton, so it would run outside this transaction and could leave a
    // profile-less facility behind.
    const facilityId = await db.transaction(async (tx) => {
      const [facility] = await tx
        .insert(facilities)
        .values({
          displayName: data.name,
          stateId: data.stateId,
          municipalityId: data.municipalityId,
          legalDocumentType: data.legalDocumentType,
          legalDocument: normalizeLegalDocument(data.legalDocument ?? null),
          location: locationPointSql(lat, lng),
        })
        .returning({ id: facilities.id });

      if (!facility) {
        throw new ValidationError([
          { field: "name", message: "Failed to create clinic" },
        ]);
      }

      await tx.insert(facilityVerticalProfiles).values({
        facilityId: facility.id,
        verticalId: data.verticalId,
        isActive: true,
      });

      return facility.id;
    });

    const refreshed = await this.findById(facilityId);
    if (!refreshed) {
      throw new ResourceNotFoundError("Clinic", facilityId);
    }
    return refreshed;
  }

  async update(
    id: number,
    data: {
      name?: string;
      lat?: number | null;
      lng?: number | null;
      imageUrl?: string | null;
      imageBlurhash?: string | null;
      billingEmail?: string | null;
      legalDocumentType?: "CNPJ" | "CPF";
      legalDocument?: string | null;
    }
  ): Promise<FacilityRecord> {
    const setData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      setData.displayName = data.name;
    }

    if (data.imageUrl !== undefined) {
      setData.imageUrl = data.imageUrl;
    }

    if (data.imageBlurhash !== undefined) {
      setData.imageBlurhash = data.imageBlurhash;
    }

    if (data.billingEmail !== undefined) {
      setData.billingEmail = data.billingEmail;
    }

    if (data.legalDocumentType !== undefined) {
      setData.legalDocumentType = data.legalDocumentType;
    }

    if (data.legalDocument !== undefined) {
      setData.legalDocument = normalizeLegalDocument(data.legalDocument);
    }

    if (data.lat !== undefined || data.lng !== undefined) {
      if (data.lat != null && data.lng != null) {
        setData.location = locationPointSql(data.lat, data.lng);
      } else if (data.lat === null || data.lng === null) {
        setData.location = null;
      }
    }

    const [facility] = await db
      .update(facilities)
      .set(setData)
      .where(eq(facilities.id, id))
      .returning();

    const refreshed = await this.findById(id);
    return refreshed ?? mapFacility(facility!);
  }

  async softDelete(id: number): Promise<void> {
    await db
      .update(facilities)
      .set({ deactivatedAt: new Date(), updatedAt: new Date() })
      .where(eq(facilities.id, id));
  }

  async reactivate(id: number): Promise<FacilityRecord> {
    const [facility] = await db
      .update(facilities)
      .set({ deactivatedAt: null, updatedAt: new Date() })
      .where(eq(facilities.id, id))
      .returning();

    const refreshed = await this.findById(id);
    return refreshed ?? mapFacility(facility!);
  }

  async applyApprovedFieldUpdates(
    id: number,
    updates: {
      name?: string;
      legalName?: string | null;
      phoneNumber?: string | null;
      whatsappNumber?: string | null;
      email?: string | null;
      websiteUrl?: string | null;
      responsibleName?: string | null;
      openingHours?: string | null;
      legalDocumentType?: "CNPJ" | "CPF" | null;
      legalDocument?: string | null;
      neighborhood?: string | null;
      streetAddress?: string | null;
      streetNumber?: string | null;
      addressComplement?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
      lat?: number | null;
      lng?: number | null;
    }
  ): Promise<FacilityRecord> {
    const setData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) setData.displayName = updates.name;
    if (updates.legalName !== undefined) setData.legalName = updates.legalName;
    if (updates.phoneNumber !== undefined) setData.phoneNumber = updates.phoneNumber;
    if (updates.whatsappNumber !== undefined) {
      setData.whatsappNumber = updates.whatsappNumber;
    }
    if (updates.email !== undefined) setData.email = updates.email;
    if (updates.websiteUrl !== undefined) setData.websiteUrl = updates.websiteUrl;
    if (updates.responsibleName !== undefined) {
      setData.responsibleName = updates.responsibleName;
    }
    if (updates.openingHours !== undefined) setData.openingHours = updates.openingHours;
    if (updates.legalDocumentType !== undefined) {
      setData.legalDocumentType = updates.legalDocumentType;
    }
    if (updates.legalDocument !== undefined) {
      setData.legalDocument = normalizeLegalDocument(updates.legalDocument);
    }
    if (updates.neighborhood !== undefined) setData.neighborhood = updates.neighborhood;
    if (updates.streetAddress !== undefined) setData.streetAddress = updates.streetAddress;
    if (updates.streetNumber !== undefined) setData.streetNumber = updates.streetNumber;
    if (updates.addressComplement !== undefined) {
      setData.addressComplement = updates.addressComplement;
    }
    // city/state text columns dropped — display via municipality/state JOIN only.
    if (updates.postalCode !== undefined) setData.postalCode = updates.postalCode;
    if (updates.country !== undefined) setData.country = updates.country;

    if (updates.lat !== undefined || updates.lng !== undefined) {
      if (updates.lat != null && updates.lng != null) {
        setData.location = locationPointSql(updates.lat, updates.lng);
      } else if (updates.lat === null || updates.lng === null) {
        setData.location = null;
      }
    }

    await db.update(facilities).set(setData).where(eq(facilities.id, id));

    const refreshed = await this.findById(id);
    if (!refreshed) {
      throw new ResourceNotFoundError("Clinic", id);
    }
    return refreshed;
  }

  async listMapPoints(scope: FacilityListScopeFilter): Promise<FacilityMapPoint[]> {
    const where = and(
      buildFacilityListConditions({ scope }),
      sql`${facilities.location} IS NOT NULL`,
    );

    const verticalIds = scope.verticalIds;
    const verticalFilterSql =
      verticalIds && verticalIds.length > 0
        ? sql`and p.vertical_id in (${sql.join(
            verticalIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql``;
    const purchaseBucketSql = sql<"active" | "inactive" | "neverBought">`(
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM ${facilityVerticalProfiles} p
          WHERE p.facility_id = facilities.id
            AND p.is_active = true
            ${verticalFilterSql}
            AND p.purchase_funnel_stage = 'PURCHASE_WINDOW'
        ) THEN 'active'
        WHEN EXISTS (
          SELECT 1
          FROM ${facilityVerticalProfiles} p
          WHERE p.facility_id = facilities.id
            AND p.is_active = true
            ${verticalFilterSql}
            AND p.purchase_funnel_stage IN ('OUTSIDE_WINDOW', 'CHURN')
        ) THEN 'inactive'
        ELSE 'neverBought'
      END
    )`;

    const rows = await db
      .select({
        id: facilities.id,
        name: facilities.displayName,
        lat: locationLatSql,
        lng: locationLngSql,
        purchaseBucket: purchaseBucketSql,
      })
      .from(facilities)
      .where(where)
      .orderBy(asc(facilities.displayName), asc(facilities.id));

    return rows.flatMap((row) => {
      if (row.lat == null || row.lng == null) return [];
      const bucket = row.purchaseBucket;
      const purchaseBucket =
        bucket === "active" || bucket === "inactive" || bucket === "neverBought"
          ? bucket
          : "neverBought";
      return [
        {
          id: row.id,
          name: row.name,
          lat: Number(row.lat),
          lng: Number(row.lng),
          purchaseBucket,
        },
      ];
    });
  }

  async findIdsByTerritoryIds(territoryIds: number[]): Promise<number[]> {
    if (territoryIds.length === 0) return [];

    // Membership = facility_vertical_profiles.manager_zone_id (Spec 0006).
    const profileRows = await db
      .select({ id: facilities.id })
      .from(facilities)
      .innerJoin(
        facilityVerticalProfiles,
        eq(facilityVerticalProfiles.facilityId, facilities.id),
      )
      .where(
        and(
          isNull(facilities.deactivatedAt),
          eq(facilityVerticalProfiles.isActive, true),
          inArray(facilityVerticalProfiles.managerZoneId, territoryIds),
        ),
      );

    return [...new Set(profileRows.map((r) => r.id))];
  }

  async findActiveFacilityIdsByVerticalIds(verticalIds: number[]): Promise<number[]> {
    if (verticalIds.length === 0) return [];

    const rows = await db
      .select({ facilityId: facilityVerticalProfiles.facilityId })
      .from(facilityVerticalProfiles)
      .where(
        and(
          inArray(facilityVerticalProfiles.verticalId, verticalIds),
          eq(facilityVerticalProfiles.isActive, true),
        ),
      );

    return [...new Set(rows.map((r) => r.facilityId))];
  }

  async findVerticalProfilesByFacilityIds(
    facilityIds: number[],
    verticalIds?: number[],
  ): Promise<Map<number, FacilityVerticalProfileRecord[]>> {
    return loadVerticalProfiles(facilityIds, verticalIds);
  }

  async updateVerticalProfileCommercialStatus(input: {
    facilityId: number;
    verticalId: number;
    commercialStatus: FacilityCommercialStatus;
  }): Promise<void> {
    await db
      .update(facilityVerticalProfiles)
      .set({
        conformityStatus: input.commercialStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, input.facilityId),
          eq(facilityVerticalProfiles.verticalId, input.verticalId),
        ),
      );
  }

  async ensureVerticalProfile(input: {
    facilityId: number;
    verticalId: number;
  }): Promise<FacilityVerticalProfileRecord> {
    const existing = await db
      .select({
        id: facilityVerticalProfiles.id,
        verticalId: facilityVerticalProfiles.verticalId,
        verticalCode: businessVerticals.code,
        verticalName: businessVerticals.name,
        isActive: facilityVerticalProfiles.isActive,
        commercialStatus: facilityVerticalProfiles.conformityStatus,
      })
      .from(facilityVerticalProfiles)
      .innerJoin(businessVerticals, eq(facilityVerticalProfiles.verticalId, businessVerticals.id))
      .where(
        and(
          eq(facilityVerticalProfiles.facilityId, input.facilityId),
          eq(facilityVerticalProfiles.verticalId, input.verticalId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const row = existing[0];
      return {
        id: row.id,
        verticalId: row.verticalId,
        verticalCode: row.verticalCode,
        verticalName: row.verticalName,
        isActive: row.isActive,
        commercialStatus: row.commercialStatus,
      };
    }

    const [inserted] = await db
      .insert(facilityVerticalProfiles)
      .values({
        facilityId: input.facilityId,
        verticalId: input.verticalId,
        isActive: true,
      })
      .returning({ id: facilityVerticalProfiles.id });

    if (!inserted) {
      throw new ResourceNotFoundError("FacilityVerticalProfile", input.verticalId);
    }

    const profiles = await loadVerticalProfiles([input.facilityId], [input.verticalId]);
    const profile = profiles.get(input.facilityId)?.[0];
    if (!profile) {
      throw new ResourceNotFoundError("FacilityVerticalProfile", input.verticalId);
    }
    return profile;
  }
}
