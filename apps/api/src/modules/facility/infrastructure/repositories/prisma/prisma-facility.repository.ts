import {
  facilities,
} from "@atlasmed/database";
import { eq, and, isNull, ilike, inArray, sql, asc } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityListScopeFilter,
  FacilityRecord,
  FacilityRepository,
  FacilitySourceUpsertInput,
} from "../../../application/interfaces/facility.repository.interface";

type FacilityRow = typeof facilities.$inferSelect;

function mapFacility(facility: FacilityRow): FacilityRecord {
  return {
    id: facility.id,
    name: facility.displayName,
    city: facility.city,
    state: facility.state,
    cnpj: facility.cnpj,
    // location geometry column replaces lat/lng; spatial repos handle geometry
    lat: null,
    lng: null,
    territoryId: facility.territoryId,
    territoryAssignmentStatus: facility.territoryAssignmentStatus,
    territoryAssignmentSource: facility.territoryAssignmentSource,
    purchaseStatus: facility.purchaseStatus ?? null,
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
  };
}

function buildScopeCondition(scope: FacilityListScopeFilter) {
  if (scope.isGlobal) return null;
  const ids = scope.facilityIds?.length ? scope.facilityIds : ["__none__"];
  return inArray(facilities.id, ids);
}

export class PrismaFacilityRepository implements FacilityRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    scope: FacilityListScopeFilter;
  }): Promise<{ facilities: FacilityRecord[]; total: number }> {
    const conditions = [isNull(facilities.deactivatedAt)];

    const scopeCondition = buildScopeCondition(params.scope);
    if (scopeCondition) conditions.push(scopeCondition);

    if (params.search) {
      conditions.push(ilike(facilities.displayName, `%${params.search}%`));
    }

    const where = and(...conditions);
    const skip = (params.page - 1) * params.limit;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(facilities).where(where).orderBy(asc(facilities.displayName)).offset(skip).limit(params.limit),
      db.select({ count: sql<number>`count(*)::int` }).from(facilities).where(where),
    ]);

    return {
      facilities: rows.map(mapFacility),
      total: count,
    };
  }

  async findById(id: string): Promise<FacilityRecord | null> {
    const [facility] = await db
      .select()
      .from(facilities)
      .where(and(eq(facilities.id, id), isNull(facilities.deactivatedAt)))
      .limit(1);

    return facility ? mapFacility(facility) : null;
  }

  async findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<FacilityRecord | null> {
    const [facility] = await db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, sourceProvider),
          eq(facilities.externalSourceId, externalSourceId)
        )
      )
      .limit(1);

    return facility ? mapFacility(facility) : null;
  }

  async findSourceTrackedByProvider(sourceProvider: string): Promise<FacilityRecord[]> {
    const rows = await db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, sourceProvider),
          eq(facilities.sourceTracked, true)
        )
      );

    return rows.map(mapFacility);
  }

  async create(data: {
    name: string;
    lat?: number | null;
    lng?: number | null;
  }): Promise<FacilityRecord> {
    const [facility] = await db
      .insert(facilities)
      .values({
        displayName: data.name,
        // lat/lng not in schema; location (geometry) handled by spatial repo
      })
      .returning();

    return mapFacility(facility);
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
    const setData: Partial<typeof facilities.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
      manuallyEditedAt: data.manuallyEditedAt,
    };

    if (data.name !== undefined) {
      setData.displayName = data.name;
    }

    const [facility] = await db
      .update(facilities)
      .set(setData)
      .where(eq(facilities.id, id))
      .returning();

    return mapFacility(facility);
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

    return mapFacility(facility);
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
      const [facility] = await db
        .insert(facilities)
        .values({
          displayName: input.name,
          // lat/lng not in schema; location (geometry) handled by spatial repo
          sourceProvider: input.sourceProvider,
          externalSourceId: input.externalSourceId,
          sourceContentHash: input.sourceContentHash,
          sourceFirstSeenAt: input.sourceLastSeenAt,
          sourceLastSeenAt: input.sourceLastSeenAt,
          sourcePresent: true,
          sourceTracked: true,
        })
        .returning();

      return { facility: mapFacility(facility), created: true, updated: false };
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

    return {
      facility: mapFacility(facility),
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
    const setData: Partial<typeof facilities.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) setData.displayName = updates.name;
    // lat/lng not in schema; location (geometry) handled by spatial repo

    const [facility] = await db
      .update(facilities)
      .set(setData)
      .where(eq(facilities.id, id))
      .returning();

    return mapFacility(facility);
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
