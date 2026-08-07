import type { Role } from "@atlasmed/access";
import { db } from "../../../../../infrastructure/database/db";
import {
  territories,
  territoryTypes,
  userTerritoryAssignments,
  facilities,
  facilityVerticalProfiles,
  users,
  roles,
  invitations,
  invitationTerritoryAssignments,
} from "@atlasmed/database";
import { eq, and, ne, inArray, asc, isNull, sql } from "drizzle-orm";
import type {
  CreateTerritoryInput,
  TerritoryRecord,
  TerritoryRepository,
} from "../../../application/interfaces/territory.repository.interface";
import type { TerritoryTypeRecord } from "../../../application/interfaces/territory-type.repository.interface";
import { REP_PATCH_TYPE_SLUG } from "../../../application/constants/territory-roles.constants";

function mapType(record: {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  canHaveBoundary: boolean;
  blockSiblingOverlap: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryTypeRecord {
  return record;
}

function mapTerritory(territory: {
  id: number;
  name: string;
  slug: string;
  code: string;
  verticalId: number;
  territoryTypeId: number;
  territoryType?: Parameters<typeof mapType>[0];
  managerTerritoryId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TerritoryRecord {
  return {
    id: territory.id,
    name: territory.name,
    slug: territory.slug,
    code: territory.code,
    verticalId: territory.verticalId,
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
  private async findOneWithType(id: number): Promise<TerritoryRecord | null> {
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(eq(territories.id, id));
    return rows[0] ? fromJoinedRow(rows[0]) : null;
  }

  async findById(id: number): Promise<TerritoryRecord | null> {
    return this.findOneWithType(id);
  }

  async findBySlug(slug: string, verticalId?: number): Promise<TerritoryRecord | null> {
    const conditions = [eq(territories.slug, slug.toLowerCase())];
    if (verticalId) {
      conditions.push(eq(territories.verticalId, verticalId));
    }
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(and(...conditions));
    return rows[0] ? fromJoinedRow(rows[0]) : null;
  }

  async findByCode(code: string, verticalId?: number): Promise<TerritoryRecord | null> {
    const conditions = [eq(territories.code, code)];
    if (verticalId) {
      conditions.push(eq(territories.verticalId, verticalId));
    }
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(and(...conditions));
    return rows[0] ? fromJoinedRow(rows[0]) : null;
  }

  async findByIds(ids: number[]): Promise<TerritoryRecord[]> {
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

  async findAllActive(verticalId?: number): Promise<TerritoryRecord[]> {
    const conditions = [eq(territories.isActive, true)];
    if (verticalId) {
      conditions.push(eq(territories.verticalId, verticalId));
    }
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .leftJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(and(...conditions))
      .orderBy(asc(territories.code));
    return rows.map(fromJoinedRow);
  }

  async findActiveByTypeSlug(typeSlug: string, verticalId?: number): Promise<TerritoryRecord[]> {
    const conditions = [
      eq(territories.isActive, true),
      eq(territoryTypes.slug, typeSlug),
    ];
    if (verticalId) {
      conditions.push(eq(territories.verticalId, verticalId));
    }
    const rows = await db
      .select({ territories, territoryTypes })
      .from(territories)
      .innerJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(and(...conditions))
      .orderBy(asc(territories.name));
    return rows.map(fromJoinedRow);
  }

  async countRepPatchesByManagerZone(managerTerritoryId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(territories)
      .innerJoin(territoryTypes, eq(territories.territoryTypeId, territoryTypes.id))
      .where(
        and(
          eq(territories.managerTerritoryId, managerTerritoryId),
          eq(territories.isActive, true),
          eq(territoryTypes.slug, REP_PATCH_TYPE_SLUG)
        )
      );
    return Number(result?.count ?? 0);
  }

  async countClinics(territoryId: number): Promise<number> {
    const [result] = await db
      .select({
        count: sql<number>`count(DISTINCT ${facilities.id})`,
      })
      .from(facilities)
      .innerJoin(
        facilityVerticalProfiles,
        and(
          eq(facilityVerticalProfiles.facilityId, facilities.id),
          eq(facilityVerticalProfiles.managerZoneId, territoryId),
          eq(facilityVerticalProfiles.isActive, true),
        ),
      )
      .where(isNull(facilities.deactivatedAt));
    return Number(result?.count ?? 0);
  }

  async countAssignedUsers(territoryId: number): Promise<number> {
    const [[uta], [staged]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(userTerritoryAssignments)
        .where(eq(userTerritoryAssignments.territoryId, territoryId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(invitationTerritoryAssignments)
        .innerJoin(
          invitations,
          eq(invitationTerritoryAssignments.invitationId, invitations.id),
        )
        .where(
          and(
            eq(invitationTerritoryAssignments.territoryId, territoryId),
            eq(invitations.status, "PENDING"),
          ),
        ),
    ]);
    // Live assignees + patches already locked on a pending invite.
    return Number(uta?.count ?? 0) + Number(staged?.count ?? 0);
  }

  async create(input: CreateTerritoryInput): Promise<TerritoryRecord> {
    const [inserted] = await db
      .insert(territories)
      .values({
        name: input.name,
        slug: input.slug,
        code: input.code ?? input.slug.toUpperCase(),
        verticalId: input.verticalId,
        territoryTypeId: input.territoryTypeId,
        managerTerritoryId: input.managerTerritoryId ?? null,
      })
      .returning({ id: territories.id });
    return (await this.findOneWithType(inserted!.id))!;
  }

  async update(
    id: number,
    data: {
      name?: string;
      managerTerritoryId?: number | null;
      isActive?: boolean;
    }
  ): Promise<TerritoryRecord> {
    await db
      .update(territories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(territories.id, id));
    return (await this.findOneWithType(id))!;
  }

  async findRepPatchIdsByManagerTerritoryIds(managerTerritoryIds: number[]): Promise<number[]> {
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
          eq(territoryTypes.slug, REP_PATCH_TYPE_SLUG)
        )
      );

    return rows.map((r) => r.id);
  }

  async findConflictingAssignments(params: {
    territoryId: number;
    excludeUserId: number;
    roles: Role[];
  }): Promise<Array<{ userId: number }>> {
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
