import { eq, and, isNull, inArray, desc, sql } from "drizzle-orm";
import { users, userTerritoryAssignments } from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type { ScopeRepository } from "../../../application/interfaces/scope.repository.interface";

export class PrismaScopeRepository implements ScopeRepository {
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

  async findManagerIdByUserId(userId: string): Promise<string | null> {
    const [row] = await db
      .select({ managerId: users.managerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return row?.managerId ?? null;
  }
}
