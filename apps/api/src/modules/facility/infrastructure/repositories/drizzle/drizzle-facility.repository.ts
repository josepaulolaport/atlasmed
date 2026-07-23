import {
  facilities,
  facilityProfessionals,
  facilityConsultantAssignments,
  facilityServices,
  territories,
  users,
  orders,
  orderItems,
} from "@atlasmed/database";
import { eq, and, isNull, ilike, inArray, sql, asc, getTableColumns } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import { ResourceNotFoundError } from "../../../../../shared/errors";
import type {
  FacilityListRecord,
  FacilityListScopeFilter,
  FacilityRecord,
  FacilityRepository,
  FacilitySourceUpsertInput,
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

function mapFacility(
  facility: FacilityRowWithCoords | FacilityRow,
  options: {
    lat?: number | null;
    lng?: number | null;
    services?: Array<{ serviceCode: string; classificationCode: string }>;
    consultantName?: string | null;
    consultantSince?: Date | null;
    managerName?: string | null;
    territoryName?: string | null;
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
    territoryId: facility.territoryId,
    territoryName: options.territoryName ?? null,
    territoryAssignmentStatus: facility.territoryAssignmentStatus,
    territoryAssignmentSource: facility.territoryAssignmentSource,
    commercialStatus: facility.commercialStatus ?? null,
    purchaseStatus: facility.purchaseStatus ?? null,
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
  };
}

function buildScopeCondition(scope: FacilityListScopeFilter) {
  if (scope.isGlobal) return null;
  const ids = scope.facilityIds?.length ? scope.facilityIds : ["__none__"];
  return inArray(facilities.id, ids);
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
      conditions.push(eq(facilities.commercialStatus, params.commercialStatus));
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
      loadTerritoryNames(rows.map((row) => row.territoryId)),
    ]);

    const countMap = new Map(profCounts.map((r) => [r.facilityId, r.count]));

    return {
      facilities: rows.map((row) => {
        const consultant = consultantMap.get(row.id);
        return {
          ...mapFacility(row, {
            lat: row.lat,
            lng: row.lng,
            consultantName: consultant?.name ?? null,
            consultantSince: consultant?.since ?? null,
            managerName: consultant?.managerName ?? null,
            territoryName: row.territoryId
              ? (territoryNameById.get(row.territoryId) ?? null)
              : null,
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

    const [services, consultantMap, territoryNameById] = await Promise.all([
      db
        .select({
          serviceCode: facilityServices.serviceCode,
          classificationCode: facilityServices.classificationCode,
        })
        .from(facilityServices)
        .where(eq(facilityServices.facilityId, id)),
      loadConsultantInfo([id]),
      loadTerritoryNames([facility.territoryId]),
    ]);

    const consultant = consultantMap.get(id);
    return mapFacility(facility, {
      lat: facility.lat,
      lng: facility.lng,
      services,
      consultantName: consultant?.name ?? null,
      consultantSince: consultant?.since ?? null,
      managerName: consultant?.managerName ?? null,
      territoryName: facility.territoryId
        ? (territoryNameById.get(facility.territoryId) ?? null)
        : null,
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
      commercialStatus?: FacilityRecord["commercialStatus"];
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

    if (data.commercialStatus !== undefined) {
      setData.commercialStatus = data.commercialStatus;
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
      lat?: number | null;
      lng?: number | null;
    }
  ): Promise<FacilityRecord> {
    const setData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) setData.displayName = updates.name;

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

    const rows = await db
      .select({ id: facilities.id })
      .from(facilities)
      .where(
        and(isNull(facilities.deactivatedAt), inArray(facilities.territoryId, territoryIds))
      );

    return rows.map((r) => r.id);
  }
}
