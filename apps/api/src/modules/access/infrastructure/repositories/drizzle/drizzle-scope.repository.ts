import { eq, and, isNull, inArray, desc, sql } from "drizzle-orm";
import { users, userTerritoryAssignments, sectors, userSectorAssignments, territories } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type { ScopeRepository } from "../../../application/interfaces/scope.repository.interface";

export class DrizzleScopeRepository implements ScopeRepository {
  async findTerritoryIdsByUserId(userId: string): Promise<string[]> {
    const rows = await db
      .select({ territoryId: userTerritoryAssignments.territoryId })
      .from(userTerritoryAssignments)
      .where(eq(userTerritoryAssignments.userId, userId));

    return rows.map((row) => row.territoryId);
  }

  async findTerritoryIdsByUserIds(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({ territoryId: userTerritoryAssignments.territoryId })
      .from(userTerritoryAssignments)
      .where(inArray(userTerritoryAssignments.userId, userIds));

    return rows.map((row) => row.territoryId);
  }

  async findManagedUserIds(managerId: string): Promise<string[]> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.managerId, managerId as any), isNull(users.deletedAt)));

    return rows.map((row) => row.id);
  }

  async assignTerritory(params: {
    userId: string;
    territoryId: string;
    assignedBy: string;
  }): Promise<void> {
    await db
      .insert(userTerritoryAssignments)
      .values({
        userId: params.userId,
        territoryId: params.territoryId,
        assignedBy: params.assignedBy,
      })
      .onConflictDoUpdate({
        target: [userTerritoryAssignments.userId, userTerritoryAssignments.territoryId],
        set: {
          assignedBy: params.assignedBy,
          updatedAt: new Date(),
        },
      });
  }

  async revokeTerritory(params: { userId: string; territoryId: string }): Promise<void> {
    await db
      .delete(userTerritoryAssignments)
      .where(
        and(
          eq(userTerritoryAssignments.userId, params.userId),
          eq(userTerritoryAssignments.territoryId, params.territoryId),
        ),
      );
  }

  async findTerritoryAssignmentsByUserId(userId: string): Promise<
    Array<{
      territoryId: string;
      assignedAt: Date;
    }>
  > {
    const rows = await db
      .select({
        territoryId: userTerritoryAssignments.territoryId,
        createdAt: userTerritoryAssignments.createdAt,
      })
      .from(userTerritoryAssignments)
      .where(eq(userTerritoryAssignments.userId, userId))
      .orderBy(desc(userTerritoryAssignments.createdAt));

    return rows.map((row) => ({
      territoryId: row.territoryId,
      assignedAt: row.createdAt,
    }));
  }

  async findUserIdsByTerritoryId(territoryId: string): Promise<
    Array<{ userId: string; assignedAt: Date }>
  > {
    const rows = await db
      .select({
        userId: userTerritoryAssignments.userId,
        createdAt: userTerritoryAssignments.createdAt,
      })
      .from(userTerritoryAssignments)
      .where(eq(userTerritoryAssignments.territoryId, territoryId))
      .orderBy(desc(userTerritoryAssignments.createdAt));

    return rows.map((row) => ({
      userId: row.userId,
      assignedAt: row.createdAt,
    }));
  }

  async findManagerIdByUserId(userId: string): Promise<string | null> {
    const [row] = await db
      .select({ managerId: users.managerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row?.managerId ?? null;
  }

  async findSectorIdsByUserId(userId: string): Promise<string[]> {
    const rows = await db
      .select({ sectorId: userSectorAssignments.sectorId })
      .from(userSectorAssignments)
      .where(eq(userSectorAssignments.userId, userId));

    return rows.map((r) => r.sectorId);
  }

  async findTerritoryIdsBySectorIds(sectorIds: string[]): Promise<string[]> {
    if (sectorIds.length === 0) return [];

    const rows = await db
      .select({ id: territories.id })
      .from(territories)
      .where(and(eq(territories.isActive, true), inArray(territories.sectorId as any, sectorIds)));

    return rows.map((r) => r.id);
  }

  async assignSector(params: {
    userId: string;
    sectorId: string;
    assignedByUserId: string;
    managerId?: string | null;
  }): Promise<void> {
    const managerId =
      params.managerId === undefined ? undefined : params.managerId;

    await db
      .insert(userSectorAssignments)
      .values({
        userId: params.userId,
        sectorId: params.sectorId,
        assignedByUserId: params.assignedByUserId,
        managerId: managerId === undefined ? null : managerId,
      })
      .onConflictDoUpdate({
        target: [userSectorAssignments.userId, userSectorAssignments.sectorId],
        set: {
          assignedByUserId: params.assignedByUserId,
          ...(managerId !== undefined ? { managerId } : {}),
          updatedAt: new Date(),
        },
      });
  }

  async revokeSector(params: { userId: string; sectorId: string }): Promise<void> {
    await db
      .delete(userSectorAssignments)
      .where(
        and(
          eq(userSectorAssignments.userId, params.userId),
          eq(userSectorAssignments.sectorId, params.sectorId)
        )
      );
  }

  async findSectorAssignmentsByUserId(userId: string): Promise<
    Array<{ sectorId: string; managerId: string | null; assignedAt: Date }>
  > {
    const rows = await db
      .select({
        sectorId: userSectorAssignments.sectorId,
        managerId: userSectorAssignments.managerId,
        createdAt: userSectorAssignments.createdAt,
      })
      .from(userSectorAssignments)
      .where(eq(userSectorAssignments.userId, userId))
      .orderBy(desc(userSectorAssignments.createdAt));

    return rows.map((r) => ({
      sectorId: r.sectorId,
      managerId: r.managerId ?? null,
      assignedAt: r.createdAt,
    }));
  }

  async replaceAssignments(params: {
    userId: string;
    assignedByUserId: string;
    managerId: string | null;
    sectorAssignments: Array<{
      sectorId: string;
      managerId?: string | null;
      territoryIds: string[];
    }>;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(userTerritoryAssignments)
        .where(eq(userTerritoryAssignments.userId, params.userId));
      await tx
        .delete(userSectorAssignments)
        .where(eq(userSectorAssignments.userId, params.userId));

      await tx
        .update(users)
        .set({ managerId: params.managerId, updatedAt: new Date() })
        .where(eq(users.id, params.userId));

      for (const sector of params.sectorAssignments) {
        await tx.insert(userSectorAssignments).values({
          userId: params.userId,
          sectorId: sector.sectorId,
          assignedByUserId: params.assignedByUserId,
          managerId: sector.managerId ?? null,
        });

        for (const territoryId of sector.territoryIds) {
          await tx.insert(userTerritoryAssignments).values({
            userId: params.userId,
            territoryId,
            assignedBy: params.assignedByUserId,
          });
        }
      }
    });
  }

  async listActiveSectors(): Promise<Array<{ id: string; slug: string; name: string }>> {
    const rows = await db
      .select({ id: sectors.id, slug: sectors.slug, name: sectors.name })
      .from(sectors)
      .where(eq(sectors.isActive, true))
      .orderBy(sectors.name);

    return rows;
  }
}
