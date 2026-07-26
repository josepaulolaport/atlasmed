import {
  facilities,
  facilityProfessionals,
  facilityConsultantAssignments,
  facilityServices,
  facilityVerticalProfiles,
  businessVerticals,
  territories,
  users,
  orders,
  orderItems,
} from "@atlasmed/database";
import { eq, and, isNull, ilike, inArray, sql, asc, getTableColumns } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { ResourceNotFoundError } from "../../../../../shared/errors";
import type {
  FacilityCommercialStatus,
  FacilityListRecord,
  FacilityListScopeFilter,
  FacilityRecord,
  FacilityRepository,
  FacilitySourceUpsertInput,
  FacilityVerticalProfileRecord,
} from "../../../application/interfaces/facility.repository.interface";

type FacilityRow = typeof facilities.$inferSelect;

type FacilityRowWithCoords = FacilityRow & {
  lat: number | null;
  lng: number | null;
};

const locationLatSql = sql<number | null>`ST_Y(${facilities.location}::geometry)`;
const locationLngSql = sql<number | null>`ST_X(${facilities.location}::geometry)`;

function locationPointSql(lat: number, lng: number) {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

function deriveProfileTerritoryId(
  profiles: Array<{ territoryId?: string | null }>,
): string | null {
  const ids = [
    ...new Set(
      profiles
        .map((p) => p.territoryId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (ids.length === 1) return ids[0]!;
  return null;
}

function mapFacility(
  facility: FacilityRowWithCoords | FacilityRow,
  options: {
    lat?: number | null;
    lng?: number | null;
    services?: Array<{ serviceCode: string; classificationCode: string }>;
    consultantName?: string | null;
    consultantSince?: Date | null;
    managerName?: string | null;
    territoryId?: string | null;
    territoryName?: string | null;
    commercialStatus?: FacilityCommercialStatus | null;
    purchaseStatus?: FacilityRecord["purchaseStatus"];
    verticalProfiles?: FacilityVerticalProfileRecord[];
  } = {}
): FacilityRecord {
  const withCoords = facility as FacilityRowWithCoords;
  return {
    id: facility.id,
    name: facility.displayName,
    neighborhood: facility.neighborhood,
    city: facility.city,
    state: facility.state,
    streetAddress: facility.streetAddress,
    streetNumber: facility.streetNumber,
    addressComplement: facility.addressComplement,
    postalCode: facility.postalCode,
    phone: facility.phoneNumber,
    whatsapp: facility.whatsappNumber,
    email: facility.email,
    website: facility.websiteUrl,
    billingEmail: facility.billingEmail ?? null,
    responsibleName: facility.responsibleName,
    openingHours: facility.openingHours,
    taxIdType: facility.taxIdType ?? "PJ",
    cnpj: facility.cnpj,
    cpf: facility.cpf,
    lat: options.lat !== undefined ? options.lat : (withCoords.lat ?? null),
    lng: options.lng !== undefined ? options.lng : (withCoords.lng ?? null),
    territoryId:
      options.territoryId !== undefined
        ? options.territoryId
        : options.verticalProfiles
          ? deriveProfileTerritoryId(options.verticalProfiles)
          : null,
    territoryName: options.territoryName ?? null,
    territoryAssignmentStatus: facility.territoryAssignmentStatus,
    territoryAssignmentSource: facility.territoryAssignmentSource,
    commercialStatus: options.commercialStatus ?? null,
    purchaseStatus: options.purchaseStatus ?? null,
    conformityStatus: facility.conformityStatus,
    consultantName: options.consultantName ?? null,
    consultantSince: options.consultantSince ?? null,
    managerName: options.managerName ?? null,
    imageUrl: facility.imageUrl ?? null,
    sourceProvider: facility.sourceProvider,
    externalSourceId: facility.externalSourceId,
    sourceContentHash: facility.sourceContentHash,
    sourceFirstSeenAt: facility.sourceFirstSeenAt,
    sourceLastSeenAt: facility.sourceLastSeenAt,
    sourcePresent: facility.sourcePresent,
    sourceTracked: facility.sourceTracked,
    manuallyEditedAt: facility.manuallyEditedAt,
    deactivatedAt: facility.deactivatedAt,
    createdAt: facility.createdAt,
    updatedAt: facility.updatedAt,
    services: options.services ?? [],
    verticalProfiles: options.verticalProfiles,
  };
}

function buildScopeCondition(scope: FacilityListScopeFilter) {
  const conditions = [];
  if (!scope.isGlobal) {
    const ids = scope.facilityIds?.length ? scope.facilityIds : ["__none__"];
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
  facilityIds: string[],
  verticalIds?: string[],
): Promise<Map<string, FacilityVerticalProfileRecord[]>> {
  if (facilityIds.length === 0) return new Map();

  const profileConditions = [inArray(facilityVerticalProfiles.facilityId, facilityIds)];
  if (verticalIds && verticalIds.length > 0) {
    profileConditions.push(inArray(facilityVerticalProfiles.verticalId, verticalIds));
  }

  const rows = await db
    .select({
      facilityId: facilityVerticalProfiles.facilityId,
      verticalId: facilityVerticalProfiles.verticalId,
      verticalCode: businessVerticals.code,
      verticalName: businessVerticals.name,
      isActive: facilityVerticalProfiles.isActive,
      commercialStatus: facilityVerticalProfiles.commercialStatus,
      purchaseStatus: facilityVerticalProfiles.purchaseStatus,
      territoryId: facilityVerticalProfiles.territoryId,
    })
    .from(facilityVerticalProfiles)
    .innerJoin(businessVerticals, eq(facilityVerticalProfiles.verticalId, businessVerticals.id))
    .where(and(...profileConditions));

  const map = new Map<string, FacilityVerticalProfileRecord[]>();
  for (const row of rows) {
    const list = map.get(row.facilityId) ?? [];
    list.push({
      verticalId: row.verticalId,
      verticalCode: row.verticalCode,
      verticalName: row.verticalName,
      isActive: row.isActive,
      commercialStatus: row.commercialStatus,
      purchaseStatus: row.purchaseStatus,
      territoryId: row.territoryId,
    });
    map.set(row.facilityId, list);
  }
  return map;
}

function deriveProfileCommercialFields(
  profiles: FacilityVerticalProfileRecord[],
): Pick<FacilityRecord, "commercialStatus" | "purchaseStatus"> {
  if (profiles.length === 1) {
    return {
      commercialStatus: profiles[0]!.commercialStatus,
      purchaseStatus: profiles[0]!.purchaseStatus,
    };
  }
  return { commercialStatus: null, purchaseStatus: null };
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
  facilityIds: string[]
): Promise<Map<string, ConsultantInfo>> {
  if (facilityIds.length === 0) return new Map();

  const consultantRows = await db
    .select({
      facilityId: facilityConsultantAssignments.facilityId,
      firstName: users.firstName,
      lastName: users.lastName,
      startedAt: facilityConsultantAssignments.startedAt,
      managerId: users.managerId,
    })
    .from(facilityConsultantAssignments)
    .innerJoin(users, eq(users.id, facilityConsultantAssignments.userId))
    .where(
      and(
        inArray(facilityConsultantAssignments.facilityId, facilityIds),
        isNull(facilityConsultantAssignments.endedAt)
      )
    );

  const managerIds = [
    ...new Set(
      consultantRows
        .map((row) => row.managerId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const managerNameById = new Map<string, string | null>();
  if (managerIds.length > 0) {
    const managerRows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, managerIds));

    for (const row of managerRows) {
      managerNameById.set(row.id, displayName(row.firstName, row.lastName));
    }
  }

  return new Map(
    consultantRows.map((row) => [
      row.facilityId,
      {
        name: displayName(row.firstName, row.lastName),
        since: row.startedAt ?? null,
        managerName: row.managerId
          ? (managerNameById.get(row.managerId) ?? null)
          : null,
      },
    ])
  );
}

async function loadTerritoryNames(
  territoryIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      territoryIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
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

export class DrizzleFacilityRepository implements FacilityRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: "REGISTERED" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
    productIds?: string[];
    scope: FacilityListScopeFilter;
    candidateIds?: string[];
  }): Promise<{ facilities: FacilityListRecord[]; total: number }> {
    const conditions = [isNull(facilities.deactivatedAt)];

    const scopeCondition = buildScopeCondition(params.scope);
    if (scopeCondition) conditions.push(scopeCondition);

    if (params.candidateIds) {
      conditions.push(inArray(facilities.id, params.candidateIds));
    }

    if (params.search) {
      conditions.push(ilike(facilities.displayName, `%${params.search}%`));
    }
    if (params.commercialStatus) {
      conditions.push(
        inArray(
          facilities.id,
          db
            .select({ facilityId: facilityVerticalProfiles.facilityId })
            .from(facilityVerticalProfiles)
            .where(
              and(
                eq(facilityVerticalProfiles.commercialStatus, params.commercialStatus),
                eq(facilityVerticalProfiles.isActive, true),
                ...(params.scope.verticalIds?.length
                  ? [inArray(facilityVerticalProfiles.verticalId, params.scope.verticalIds)]
                  : []),
              ),
            ),
        ),
      );
    }
    if (params.productIds?.length) {
      conditions.push(
        inArray(
          facilities.id,
          db
            .select({ facilityId: orders.facilityId })
            .from(orders)
            .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
            .where(inArray(orderItems.productId, params.productIds))
        )
      );
    }

    const referencePoint =
      params.latitude === undefined
        ? undefined
        : sql`ST_SetSRID(ST_MakePoint(${params.longitude!}, ${params.latitude}), 4326)`;
    const distanceKm = referencePoint
      ? sql<number>`ST_Distance(${facilities.location}::geography, ${referencePoint}::geography) / 1000`
      : undefined;
    if (referencePoint) {
      conditions.push(sql`${facilities.location} IS NOT NULL`);
      if (params.radiusKm !== undefined) {
        conditions.push(
          sql`ST_DWithin(${facilities.location}::geography, ${referencePoint}::geography, ${params.radiusKm * 1000})`
        );
      }
    }

    const where = and(...conditions);
    const skip = (params.page - 1) * params.limit;

    const [rows, countRows] = await Promise.all([
      db
        .select({
          ...getTableColumns(facilities),
          lat: locationLatSql,
          lng: locationLngSql,
          distanceKm: distanceKm ?? sql<number | null>`null`,
        })
        .from(facilities)
        .where(where)
        .orderBy(
          ...(distanceKm
            ? [asc(distanceKm), asc(facilities.displayName)]
            : [asc(facilities.displayName)])
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

    const profilesByFacility = await loadVerticalProfiles(ids, params.scope.verticalIds);
    const derivedTerritoryIds = ids.map((id) =>
      deriveProfileTerritoryId(profilesByFacility.get(id) ?? []),
    );

    const [profCounts, consultantMap, territoryNameById] = await Promise.all([
      db
        .select({
          facilityId: facilityProfessionals.facilityId,
          count: sql<number>`count(*)::int`,
        })
        .from(facilityProfessionals)
        .where(
          and(
            inArray(facilityProfessionals.facilityId, ids),
            isNull(facilityProfessionals.endedAt)
          )
        )
        .groupBy(facilityProfessionals.facilityId),
      loadConsultantInfo(ids),
      loadTerritoryNames(derivedTerritoryIds),
    ]);

    const countMap = new Map(profCounts.map((r) => [r.facilityId, r.count]));

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
            consultantName: consultant?.name ?? null,
            consultantSince: consultant?.since ?? null,
            managerName: consultant?.managerName ?? null,
            territoryId,
            territoryName: territoryId
              ? (territoryNameById.get(territoryId) ?? null)
              : null,
            commercialStatus: derived.commercialStatus,
            purchaseStatus: derived.purchaseStatus,
            verticalProfiles: profiles,
          }),
          distanceKm: row.distanceKm ?? null,
          professionalCount: countMap.get(row.id) ?? 0,
        };
      }),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findAllByIds(params: {
    ids: string[];
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: "REGISTERED" | "ACTIVE" | "SUSPENDED" | "INACTIVE";
    productIds?: string[];
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

  async findById(id: string): Promise<FacilityRecord | null> {
    const [facility] = await db
      .select({
        ...getTableColumns(facilities),
        lat: locationLatSql,
        lng: locationLngSql,
      })
      .from(facilities)
      .where(and(eq(facilities.id, id), isNull(facilities.deactivatedAt)))
      .limit(1);

    if (!facility) return null;

    const profilesByFacility = await loadVerticalProfiles([id]);
    const profiles = profilesByFacility.get(id) ?? [];
    const territoryId = deriveProfileTerritoryId(profiles);

    const [services, consultantMap, territoryNameById] = await Promise.all([
      db
        .select({
          serviceCode: facilityServices.serviceCode,
          classificationCode: facilityServices.classificationCode,
        })
        .from(facilityServices)
        .where(eq(facilityServices.facilityId, id)),
      loadConsultantInfo([id]),
      loadTerritoryNames([territoryId]),
    ]);

    const consultant = consultantMap.get(id);
    const derived = deriveProfileCommercialFields(profiles);
    return mapFacility(facility, {
      lat: facility.lat,
      lng: facility.lng,
      services,
      consultantName: consultant?.name ?? null,
      consultantSince: consultant?.since ?? null,
      managerName: consultant?.managerName ?? null,
      territoryId,
      territoryName: territoryId
        ? (territoryNameById.get(territoryId) ?? null)
        : null,
      commercialStatus: derived.commercialStatus,
      purchaseStatus: derived.purchaseStatus,
      verticalProfiles: profiles,
    });
  }

  async findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<FacilityRecord | null> {
    const [facility] = await db
      .select({
        ...getTableColumns(facilities),
        lat: locationLatSql,
        lng: locationLngSql,
      })
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, sourceProvider),
          eq(facilities.externalSourceId, externalSourceId)
        )
      )
      .limit(1);

    return facility
      ? mapFacility(facility, { lat: facility.lat, lng: facility.lng })
      : null;
  }

  async findSourceTrackedByProvider(sourceProvider: string): Promise<FacilityRecord[]> {
    const rows = await db
      .select({
        ...getTableColumns(facilities),
        lat: locationLatSql,
        lng: locationLngSql,
      })
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, sourceProvider),
          eq(facilities.sourceTracked, true)
        )
      );

    return rows.map((row) =>
      mapFacility(row, { lat: row.lat, lng: row.lng })
    );
  }

  async create(data: {
    name: string;
    lat?: number | null;
    lng?: number | null;
  }): Promise<FacilityRecord> {
    const hasCoords = data.lat != null && data.lng != null;
    const [facility] = await db
      .insert(facilities)
      .values({
        displayName: data.name,
        ...(hasCoords
          ? { location: locationPointSql(data.lat!, data.lng!) }
          : {}),
      })
      .returning();

    return mapFacility(facility!, {
      lat: data.lat ?? null,
      lng: data.lng ?? null,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      lat?: number | null;
      lng?: number | null;
      imageUrl?: string | null;
      billingEmail?: string | null;
      taxIdType?: "PJ" | "PF";
      conformityStatus?: FacilityRecord["conformityStatus"];
      manuallyEditedAt?: Date;
    }
  ): Promise<FacilityRecord> {
    const setData: Record<string, unknown> = {
      updatedAt: new Date(),
      manuallyEditedAt: data.manuallyEditedAt,
    };

    if (data.name !== undefined) {
      setData.displayName = data.name;
    }

    if (data.imageUrl !== undefined) {
      setData.imageUrl = data.imageUrl;
    }

    if (data.billingEmail !== undefined) {
      setData.billingEmail = data.billingEmail;
    }

    if (data.taxIdType !== undefined) {
      setData.taxIdType = data.taxIdType;
    }

    if (data.conformityStatus !== undefined) {
      setData.conformityStatus = data.conformityStatus;
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

  async softDelete(id: string): Promise<void> {
    await db
      .update(facilities)
      .set({ deactivatedAt: new Date(), updatedAt: new Date() })
      .where(eq(facilities.id, id));
  }

  async reactivate(id: string): Promise<FacilityRecord> {
    const [facility] = await db
      .update(facilities)
      .set({ deactivatedAt: null, updatedAt: new Date() })
      .where(eq(facilities.id, id))
      .returning();

    const refreshed = await this.findById(id);
    return refreshed ?? mapFacility(facility!);
  }

  async markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void> {
    await db
      .update(facilities)
      .set({ sourcePresent: false, sourceLastSeenAt, updatedAt: new Date() })
      .where(eq(facilities.id, id));
  }

  async upsertFromSource(input: FacilitySourceUpsertInput): Promise<{
    facility: FacilityRecord;
    created: boolean;
    updated: boolean;
  }> {
    const [existing] = await db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, input.sourceProvider),
          eq(facilities.externalSourceId, input.externalSourceId)
        )
      )
      .limit(1);

    if (!existing) {
      const hasCoords = input.lat != null && input.lng != null;
      const [facility] = await db
        .insert(facilities)
        .values({
          displayName: input.name,
          ...(hasCoords
            ? { location: locationPointSql(input.lat!, input.lng!) }
            : {}),
          sourceProvider: input.sourceProvider,
          externalSourceId: input.externalSourceId,
          sourceContentHash: input.sourceContentHash,
          sourceFirstSeenAt: input.sourceLastSeenAt,
          sourceLastSeenAt: input.sourceLastSeenAt,
          sourcePresent: true,
          sourceTracked: true,
        })
        .returning();

      return {
        facility: mapFacility(facility!, {
          lat: input.lat ?? null,
          lng: input.lng ?? null,
        }),
        created: true,
        updated: false,
      };
    }

    const hashUnchanged = existing.sourceContentHash === input.sourceContentHash;

    const [facility] = await db
      .update(facilities)
      .set({
        sourceContentHash: input.sourceContentHash,
        sourceLastSeenAt: input.sourceLastSeenAt,
        sourcePresent: true,
        sourceTracked: true,
        updatedAt: new Date(),
      })
      .where(eq(facilities.id, existing.id))
      .returning();

    const refreshed = await this.findByExternalId(
      input.sourceProvider,
      input.externalSourceId
    );

    return {
      facility: refreshed ?? mapFacility(facility!),
      created: false,
      updated: !hashUnchanged,
    };
  }

  async applyApprovedFieldUpdates(
    id: string,
    updates: {
      name?: string;
      legalName?: string | null;
      phoneNumber?: string | null;
      whatsappNumber?: string | null;
      email?: string | null;
      websiteUrl?: string | null;
      responsibleName?: string | null;
      openingHours?: string | null;
      taxIdType?: "PJ" | "PF" | null;
      cnpj?: string | null;
      cpf?: string | null;
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
      manuallyEditedAt?: Date;
    }
  ): Promise<FacilityRecord> {
    const setData: Record<string, unknown> = {
      updatedAt: new Date(),
      manuallyEditedAt: updates.manuallyEditedAt ?? new Date(),
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
    if (updates.taxIdType !== undefined) setData.taxIdType = updates.taxIdType;
    if (updates.cnpj !== undefined) setData.cnpj = updates.cnpj;
    if (updates.cpf !== undefined) setData.cpf = updates.cpf;
    if (updates.neighborhood !== undefined) setData.neighborhood = updates.neighborhood;
    if (updates.streetAddress !== undefined) setData.streetAddress = updates.streetAddress;
    if (updates.streetNumber !== undefined) setData.streetNumber = updates.streetNumber;
    if (updates.addressComplement !== undefined) {
      setData.addressComplement = updates.addressComplement;
    }
    if (updates.city !== undefined) setData.city = updates.city;
    if (updates.state !== undefined) setData.state = updates.state;
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

  async findIdsByTerritoryIds(territoryIds: string[]): Promise<string[]> {
    if (territoryIds.length === 0) return [];

    // Membership = facility_vertical_profiles.territory_id only (legacy facilities.territoryId cut over).
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
          inArray(facilityVerticalProfiles.territoryId, territoryIds),
        ),
      );

    return [...new Set(profileRows.map((r) => r.id))];
  }

  async findActiveFacilityIdsByVerticalIds(verticalIds: string[]): Promise<string[]> {
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
    facilityIds: string[],
    verticalIds?: string[],
  ): Promise<Map<string, FacilityVerticalProfileRecord[]>> {
    return loadVerticalProfiles(facilityIds, verticalIds);
  }

  async updateVerticalProfileCommercialStatus(input: {
    facilityId: string;
    verticalId: string;
    commercialStatus: FacilityCommercialStatus;
  }): Promise<void> {
    await db
      .update(facilityVerticalProfiles)
      .set({
        commercialStatus: input.commercialStatus,
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
    facilityId: string;
    verticalId: string;
  }): Promise<FacilityVerticalProfileRecord> {
    const existing = await db
      .select({
        verticalId: facilityVerticalProfiles.verticalId,
        verticalCode: businessVerticals.code,
        verticalName: businessVerticals.name,
        isActive: facilityVerticalProfiles.isActive,
        commercialStatus: facilityVerticalProfiles.commercialStatus,
        purchaseStatus: facilityVerticalProfiles.purchaseStatus,
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
        verticalId: row.verticalId,
        verticalCode: row.verticalCode,
        verticalName: row.verticalName,
        isActive: row.isActive,
        commercialStatus: row.commercialStatus,
        purchaseStatus: row.purchaseStatus,
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
