import { eq, and, isNull, inArray, desc } from "drizzle-orm";
import {
  users,
  userTerritoryAssignments,
  businessVerticals,
  userVerticalAssignments,
} from "@atlasmed/database";
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

  async findVerticalIdsByUserId(userId: string): Promise<string[]> {
    const rows = await db
      .select({ verticalId: userVerticalAssignments.verticalId })
      .from(userVerticalAssignments)
      .where(eq(userVerticalAssignments.userId, userId));

    return rows.map((r) => r.verticalId);
  }

  async assignVertical(params: {
    userId: string;
    verticalId: string;
    assignedByUserId: string;
    managerId?: string | null;
  }): Promise<void> {
    const managerId =
      params.managerId === undefined ? undefined : params.managerId;

    await db
      .insert(userVerticalAssignments)
      .values({
        userId: params.userId,
        verticalId: params.verticalId,
        assignedByUserId: params.assignedByUserId,
        managerId: managerId === undefined ? null : managerId,
      })
      .onConflictDoUpdate({
        target: [userVerticalAssignments.userId, userVerticalAssignments.verticalId],
        set: {
          assignedByUserId: params.assignedByUserId,
          ...(managerId !== undefined ? { managerId } : {}),
          updatedAt: new Date(),
        },
      });
  }

  async revokeVertical(params: { userId: string; verticalId: string }): Promise<void> {
    await db
      .delete(userVerticalAssignments)
      .where(
        and(
          eq(userVerticalAssignments.userId, params.userId),
          eq(userVerticalAssignments.verticalId, params.verticalId)
        )
      );
  }

  async findVerticalAssignmentsByUserId(userId: string): Promise<
    Array<{ verticalId: string; managerId: string | null; assignedAt: Date }>
  > {
    const rows = await db
      .select({
        verticalId: userVerticalAssignments.verticalId,
        managerId: userVerticalAssignments.managerId,
        createdAt: userVerticalAssignments.createdAt,
      })
      .from(userVerticalAssignments)
      .where(eq(userVerticalAssignments.userId, userId))
      .orderBy(desc(userVerticalAssignments.createdAt));

    return rows.map((r) => ({
      verticalId: r.verticalId,
      managerId: r.managerId ?? null,
      assignedAt: r.createdAt,
    }));
  }

  async replaceAssignments(params: {
    userId: string;
    assignedByUserId: string;
    managerId: string | null;
    verticalAssignments: Array<{
      verticalId: string;
      managerId?: string | null;
      territoryIds: string[];
    }>;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .delete(userTerritoryAssignments)
        .where(eq(userTerritoryAssignments.userId, params.userId));
      await tx
        .delete(userVerticalAssignments)
        .where(eq(userVerticalAssignments.userId, params.userId));

      await tx
        .update(users)
        .set({ managerId: params.managerId, updatedAt: new Date() })
        .where(eq(users.id, params.userId));

      for (const vertical of params.verticalAssignments) {
        await tx.insert(userVerticalAssignments).values({
          userId: params.userId,
          verticalId: vertical.verticalId,
          assignedByUserId: params.assignedByUserId,
          managerId: vertical.managerId ?? null,
        });

        for (const territoryId of vertical.territoryIds) {
          await tx.insert(userTerritoryAssignments).values({
            userId: params.userId,
            territoryId,
            assignedBy: params.assignedByUserId,
          });
        }
      }
    });
  }

  async listActiveVerticals(): Promise<Array<{ id: string; code: string; name: string }>> {
    const rows = await db
      .select({ id: businessVerticals.id, code: businessVerticals.code, name: businessVerticals.name })
      .from(businessVerticals)
      .where(eq(businessVerticals.isActive, true))
      .orderBy(businessVerticals.name);

    return rows;
  }
}
