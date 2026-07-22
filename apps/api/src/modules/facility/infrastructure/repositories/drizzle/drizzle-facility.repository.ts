import {
  facilities,
  facilityProfessionals,
  facilityConsultantAssignments,
  facilityServices,
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
    responsibleName: facility.responsibleName,
    openingHours: facility.openingHours,
    taxIdType: facility.taxIdType ?? null,
    cnpj: facility.cnpj,
    cpf: facility.cpf,
    lat: options.lat !== undefined ? options.lat : (withCoords.lat ?? null),
    lng: options.lng !== undefined ? options.lng : (withCoords.lng ?? null),
    territoryId: facility.territoryId,
    territoryAssignmentStatus: facility.territoryAssignmentStatus,
    territoryAssignmentSource: facility.territoryAssignmentSource,
    commercialStatus: facility.commercialStatus ?? null,
    purchaseStatus: facility.purchaseStatus ?? null,
    conformityStatus: facility.conformityStatus,
    consultantName: options.consultantName ?? null,
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

async function loadConsultantNames(
  facilityIds: string[]
): Promise<Map<string, string | null>> {
  if (facilityIds.length === 0) return new Map();

  const consultantRows = await db
    .select({
      facilityId: facilityConsultantAssignments.facilityId,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(facilityConsultantAssignments)
    .innerJoin(users, eq(users.id, facilityConsultantAssignments.userId))
    .where(
      and(
        inArray(facilityConsultantAssignments.facilityId, facilityIds),
        isNull(facilityConsultantAssignments.endedAt)
      )
    );

  return new Map(
    consultantRows.map((row) => [
      row.facilityId,
      [row.firstName, row.lastName].filter(Boolean).join(" ") || null,
    ])
  );
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

    const [profCounts, consultantMap] = await Promise.all([
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
      loadConsultantNames(ids),
    ]);

    const countMap = new Map(profCounts.map((r) => [r.facilityId, r.count]));

    return {
      facilities: rows.map((row) => ({
        ...mapFacility(row, {
          lat: row.lat,
          lng: row.lng,
          consultantName: consultantMap.get(row.id) ?? null,
        }),
        distanceKm: row.distanceKm ?? null,
        professionalCount: countMap.get(row.id) ?? 0,
      })),
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

    const [services, consultantMap] = await Promise.all([
      db
        .select({
          serviceCode: facilityServices.serviceCode,
          classificationCode: facilityServices.classificationCode,
        })
        .from(facilityServices)
        .where(eq(facilityServices.facilityId, id)),
      loadConsultantNames([id]),
    ]);

    return mapFacility(facility, {
      lat: facility.lat,
      lng: facility.lng,
      services,
      consultantName: consultantMap.get(id) ?? null,
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
