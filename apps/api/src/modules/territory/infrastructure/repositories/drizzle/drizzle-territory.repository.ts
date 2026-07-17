import { db } from "../../../../../infrastructure/database/db";
import {
  territories,
  territoryTypes,
  userTerritoryAssignments,
  facilities,
} from "@atlasmed/database";
import { eq, and, inArray, asc, isNull, sql } from "drizzle-orm";
import type {
  CreateTerritoryInput,
  TerritoryRecord,
  TerritoryRepository,
} from "../../../application/interfaces/territory.repository.interface";
import type { TerritoryTypeRecord } from "../../../application/interfaces/territory-type.repository.interface";

function mapType(record: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  canHaveBoundary: boolean;
  assignsClinics: boolean;
  assignableToUsers: boolean;
  assignableToManagers: boolean;
  isCountryLevel: boolean;
  blockSiblingOverlap: boolean;
  participatesInGroupingHierarchy: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryTypeRecord {
  return record;
}

function mapTerritory(territory: {
  id: string;
  name: string;
  slug: string;
  code: string;
  nodeType: TerritoryRecord["nodeType"];
  territoryTypeId: string;
  territoryType?: Parameters<typeof mapType>[0];
  countryCode: string | null;
  regionSlug: string | null;
  stateCode: string | null;
  parentId: string | null;
  managerTerritoryId: string | null;
  isActive: boolean;
  sectorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryRecord {
  return {
    id: territory.id,
    name: territory.name,
    slug: territory.slug,
    code: territory.code,
    nodeType: territory.nodeType,
    territoryTypeId: territory.territoryTypeId,
    territoryType: territory.territoryType ? mapType(territory.territoryType) : undefined,
    countryCode: territory.countryCode,
    regionSlug: territory.regionSlug,
    stateCode: territory.stateCode,
    parentId: territory.parentId,
    managerTerritoryId: territory.managerTerritoryId,
    isActive: territory.isActive,
    sectorId: territory.sectorId,
    createdAt: territory.createdAt,
    updatedAt: territory.updatedAt,
  };
}

type TerritoryJoinedRow = {
  territories: typeof territories.$inferSelect;
  territoryTypes: typeof territoryTypes.$inferSelect | null;
};

function fromJoinedRow(row: TerritoryJoinedRow): TerritoryRecord {
  return mapTerritory({
    ...row.territories,
    territoryType: row.territoryTypes ?? undefined,
  });
}

export class DrizzleTerritoryRepository implements TerritoryRepository {
  private async findOneWithType(id: string): Promise<TerritoryRecord | null> {
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(eq(territories.id, id));
    return rows[0] ? fromJoinedRow(rows[0]) : null;
  }

  async findById(id: string): Promise<TerritoryRecord | null> {
    return this.findOneWithType(id);
  }

  async findBySlug(slug: string): Promise<TerritoryRecord | null> {
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(eq(territories.slug, slug.toLowerCase()));
    return rows[0] ? fromJoinedRow(rows[0]) : null;
  }

  async findByCode(code: string): Promise<TerritoryRecord | null> {
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(eq(territories.code, code));
    return rows[0] ? fromJoinedRow(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<TerritoryRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(inArray(territories.id, ids));
    return rows.map(fromJoinedRow);
  }

  async findAllActive(): Promise<TerritoryRecord[]> {
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(eq(territories.isActive, true))
      .orderBy(asc(territories.code));
    return rows.map(fromJoinedRow);
  }

  async findActiveByTypeSlug(typeSlug: string): Promise<TerritoryRecord[]> {
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .innerJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(and(eq(territories.isActive, true), eq(territoryTypes.slug, typeSlug)))
      .orderBy(asc(territories.name));
    return rows.map(fromJoinedRow);
  }

  async findChildren(parentId: string, activeOnly = true): Promise<TerritoryRecord[]> {
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(
        activeOnly
          ? and(eq(territories.parentId, parentId), eq(territories.isActive, true))
          : eq(territories.parentId, parentId)
      )
      .orderBy(asc(territories.name));
    return rows.map(fromJoinedRow);
  }

  async countActiveChildren(parentId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(territories)
      .where(and(eq(territories.parentId, parentId), eq(territories.isActive, true)));
    return Number(result?.count ?? 0);
  }

  async countRepPatchesByManagerZone(managerTerritoryId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(territories)
      .innerJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(
        and(
          eq(territories.managerTerritoryId, managerTerritoryId),
          eq(territories.isActive, true),
          eq(territoryTypes.assignsClinics, true)
        )
      );
    return Number(result?.count ?? 0);
  }

  async countClinics(territoryId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(facilities)
      .where(and(isNull(facilities.deactivatedAt), eq(facilities.territoryId, territoryId)));
    return Number(result?.count ?? 0);
  }

  async countAssignedUsers(territoryId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(userTerritoryAssignments)
      .where(eq(userTerritoryAssignments.territoryId, territoryId));
    return Number(result?.count ?? 0);
  }

  async create(input: CreateTerritoryInput): Promise<TerritoryRecord> {
    const [inserted] = await db
      .insert(territories)
      .values({
        name: input.name,
        slug: input.slug,
        code: input.code ?? input.slug.toUpperCase(),
        nodeType: input.nodeType,
        territoryTypeId: input.territoryTypeId,
        countryCode: input.countryCode ?? null,
        regionSlug: input.regionSlug ?? null,
        stateCode: input.stateCode ?? null,
        parentId: input.parentId ?? null,
        managerTerritoryId: input.managerTerritoryId ?? null,
        sectorId: input.sectorId ?? null,
      })
      .returning({ id: territories.id });
    return (await this.findOneWithType(inserted!.id))!;
  }

  async update(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      managerTerritoryId?: string | null;
      isActive?: boolean;
      countryCode?: string | null;
      sectorId?: string | null;
    }
  ): Promise<TerritoryRecord> {
    await db
      .update(territories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(territories.id, id));
    return (await this.findOneWithType(id))!;
  }

  async findActiveCountryByCode(countryCode: string): Promise<TerritoryRecord | null> {
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(
        and(
          eq(territories.isActive, true),
          eq(territories.countryCode, countryCode),
          eq(territoryTypes.isCountryLevel, true)
        )
      )
      .limit(1);
    return rows[0] ? fromJoinedRow(rows[0]) : null;
  }

  async findRepPatchIdsByManagerTerritoryIds(managerTerritoryIds: string[]): Promise<string[]> {
    if (managerTerritoryIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({ id: territories.id })
      .from(territories)
      .innerJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(
        and(
          eq(territories.isActive, true),
          inArray(territories.managerTerritoryId, managerTerritoryIds),
          eq(territoryTypes.assignsClinics, true)
        )
      );

    return rows.map((r) => r.id);
  }
}
