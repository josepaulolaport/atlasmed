import { eq, and, isNull, inArray, desc, sql } from "drizzle-orm";
import {
  users,
  territories,
  userTerritoryAssignments,
  businessVerticals,
  userVerticalAssignments,
} from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type { ScopeRepository } from "../../../application/interfaces/scope.repository.interface";

/** Keep slugs local — avoid access ↔ territory composition cycles. */
const MANAGER_ZONE_TYPE_SLUG = "manager_zone";
const REP_PATCH_TYPE_SLUG = "patch";

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

  /**
   * Spec 0006: REPs with a patch UTA under this manager's zones.
   * Not users.manager_id — territory-derived (multi-manager REPs allowed).
   */
  async findManagedUserIds(managerId: string): Promise<string[]> {
    const rows = await db.execute(sql`
      SELECT DISTINCT patch_uta.user_id AS id
      FROM user_territory_assignments zone_uta
      INNER JOIN territories zone ON zone.id = zone_uta.territory_id
      INNER JOIN territory_types zone_tt ON zone_tt.id = zone.territory_type_id
      INNER JOIN territories patch
        ON patch.manager_territory_id = zone.id
        AND patch.is_active = true
      INNER JOIN territory_types patch_tt ON patch_tt.id = patch.territory_type_id
      INNER JOIN user_territory_assignments patch_uta
        ON patch_uta.territory_id = patch.id
      INNER JOIN users u ON u.id = patch_uta.user_id
      WHERE zone_uta.user_id = ${managerId}
        AND zone.is_active = true
        AND zone_tt.slug = ${MANAGER_ZONE_TYPE_SLUG}
        AND patch_tt.slug = ${REP_PATCH_TYPE_SLUG}
        AND u.deleted_at IS NULL
    `) as Array<{ id: string }>;

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

  async findManagerIdByUserId(_userId: string): Promise<string | null> {
    // Spec 0006: users.manager_id dropped — manager is territory-derived.
    return null;
  }

  async findVerticalIdsByUserId(userId: string): Promise<string[]> {
    const [uvaRows, territoryRows] = await Promise.all([
      db
        .select({ verticalId: userVerticalAssignments.verticalId })
        .from(userVerticalAssignments)
        .where(eq(userVerticalAssignments.userId, userId)),
      db
        .selectDistinct({ verticalId: territories.verticalId })
        .from(userTerritoryAssignments)
        .innerJoin(
          territories,
          eq(territories.id, userTerritoryAssignments.territoryId),
        )
        .where(eq(userTerritoryAssignments.userId, userId)),
    ]);

    return [
      ...new Set([
        ...uvaRows.map((r) => r.verticalId),
        ...territoryRows.map((r) => r.verticalId),
      ]),
    ];
  }

  async assignVertical(params: {
    userId: string;
    verticalId: string;
    assignedByUserId: string;
    managerId?: string | null;
  }): Promise<void> {
    await db
      .insert(userVerticalAssignments)
      .values({
        userId: params.userId,
        verticalId: params.verticalId,
        assignedByUserId: params.assignedByUserId,
      })
      .onConflictDoUpdate({
        target: [userVerticalAssignments.userId, userVerticalAssignments.verticalId],
        set: {
          assignedByUserId: params.assignedByUserId,
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
        createdAt: userVerticalAssignments.createdAt,
      })
      .from(userVerticalAssignments)
      .where(eq(userVerticalAssignments.userId, userId))
      .orderBy(desc(userVerticalAssignments.createdAt));

    return rows.map((r) => ({
      verticalId: r.verticalId,
      managerId: null,
      assignedAt: r.createdAt,
    }));
  }

  async replaceAssignments(params: {
    userId: string;
    assignedByUserId: string;
    verticalAssignments: Array<{
      verticalId: string;
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

      for (const vertical of params.verticalAssignments) {
        await tx.insert(userVerticalAssignments).values({
          userId: params.userId,
          verticalId: vertical.verticalId,
          assignedByUserId: params.assignedByUserId,
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
