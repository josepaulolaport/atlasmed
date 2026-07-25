import type { Role } from "@atlasmed/access";
import { db } from "../../../../../infrastructure/database/db";
import {
  territories,
  territoryTypes,
  userTerritoryAssignments,
  facilities,
  users,
  roles,
} from "@atlasmed/database";
import { eq, and, ne, inArray, asc, isNull, sql } from "drizzle-orm";
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
  blockSiblingOverlap: boolean;
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
  territoryTypeId: string;
  territoryType?: Parameters<typeof mapType>[0];
  managerTerritoryId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryRecord {
  return {
    id: territory.id,
    name: territory.name,
    slug: territory.slug,
    code: territory.code,
    territoryTypeId: territory.territoryTypeId,
    territoryType: territory.territoryType ? mapType(territory.territoryType) : undefined,
    managerTerritoryId: territory.managerTerritoryId,
    isActive: territory.isActive,
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
        territoryTypeId: input.territoryTypeId,
        managerTerritoryId: input.managerTerritoryId ?? null,
      })
      .returning({ id: territories.id });
    return (await this.findOneWithType(inserted!.id))!;
  }

  async update(
    id: string,
    data: {
      name?: string;
      managerTerritoryId?: string | null;
      isActive?: boolean;
    }
  ): Promise<TerritoryRecord> {
    await db
      .update(territories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(territories.id, id));
    return (await this.findOneWithType(id))!;
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

  async findConflictingAssignments(params: {
    territoryId: string;
    excludeUserId: string;
    roles: Role[];
  }): Promise<Array<{ userId: string }>> {
    return db
      .select({ userId: userTerritoryAssignments.userId })
      .from(userTerritoryAssignments)
      .innerJoin(users, eq(userTerritoryAssignments.userId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(userTerritoryAssignments.territoryId, params.territoryId),
          ne(userTerritoryAssignments.userId, params.excludeUserId),
          inArray(roles.name, params.roles)
        )
      );
  }
}
