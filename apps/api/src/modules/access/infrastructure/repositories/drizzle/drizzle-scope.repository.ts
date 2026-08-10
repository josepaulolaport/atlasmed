import { eq, and, inArray, desc, sql } from "drizzle-orm";
import {
  territories,
  userTerritoryAssignments,
  businessVerticals,
  userVerticalAssignments,
} from "@atlasmed/database";
import { db } from "../../../../../infrastructure/database/db";
import type { ScopeRepository } from "../../../application/interfaces/scope.repository.interface";
import { OperationNotAllowedError } from "../../../../../shared/errors";

/** Keep slugs local — avoid access ↔ territory composition cycles. */
const MANAGER_ZONE_TYPE_SLUG = "manager_zone";
const REP_PATCH_TYPE_SLUG = "patch";

export class DrizzleScopeRepository implements ScopeRepository {
  async findTerritoryIdsByUserId(userId: number): Promise<number[]> {
    const rows = await db
      .select({ territoryId: userTerritoryAssignments.territoryId })
      .from(userTerritoryAssignments)
      .where(eq(userTerritoryAssignments.userId, userId));

    return rows.map((row) => row.territoryId);
  }

  async findTerritoryIdsByUserIds(userIds: number[]): Promise<number[]> {
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
  async findManagedUserIds(managerId: number): Promise<number[]> {
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
    `) as Array<{ id: number }>;

    return rows.map((row) => row.id);
  }

  async assignTerritory(params: {
    userId: number;
    territoryId: number;
    assignedBy: number;
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

  async revokeTerritory(params: { userId: number; territoryId: number }): Promise<void> {
    await db
      .delete(userTerritoryAssignments)
      .where(
        and(
          eq(userTerritoryAssignments.userId, params.userId),
          eq(userTerritoryAssignments.territoryId, params.territoryId),
        ),
      );
  }

  async findTerritoryAssignmentsByUserId(userId: number): Promise<
    Array<{
      territoryId: number;
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

  async findUserIdsByTerritoryId(territoryId: number): Promise<
    Array<{ userId: number; assignedAt: Date }>
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

  async findManagerIdByUserId(_userId: number): Promise<number | null> {
    // Spec 0006: users.manager_id dropped — manager is territory-derived.
    return null;
  }

  /**
   * Verticals a user is a member of. UVA is the only grant (spec 0010 §1.1).
   *
   * This used to UNION in `SELECT DISTINCT territories.vertical_id` of the
   * user's territory assignments, while `GET /user/assignments` reported UVA
   * only — so assigning a territory silently granted its vertical everywhere,
   * and effective access exceeded anything any UI could show (D-29).
   *
   * The union is redundant now that invariant I6 holds: a territory can only be
   * assigned in a vertical the user already has, so every territory's vertical
   * is necessarily in UVA already.
   */
  async findVerticalIdsByUserId(userId: number): Promise<number[]> {
    const rows = await db
      .select({ verticalId: userVerticalAssignments.verticalId })
      .from(userVerticalAssignments)
      .where(eq(userVerticalAssignments.userId, userId));

    return [...new Set(rows.map((r) => r.verticalId))];
  }

  async assignVertical(params: {
    userId: number;
    verticalId: number;
    assignedByUserId: number;
    managerId?: number | null;
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

  /**
   * Spec 0010 §1.1: revoking a vertical from a user who holds territories in it
   * is BLOCKED — "remove their territories first". Never silently end UTAs.
   *
   * Without this, revoking a vertical would leave the user holding territories
   * in a vertical they are no longer a member of, which is exactly the state
   * invariant I6 forbids on the way in. The alternative — cascading the
   * revocation into their territory assignments — destroys a human decision to
   * satisfy a bookkeeping one, and the assignment rows are not recoverable.
   *
   * Enforced here because the route calls this method directly; there is no
   * use case in between to hold the rule.
   */
  async revokeVertical(params: { userId: number; verticalId: number }): Promise<void> {
    const heldTerritories = await db
      .select({ id: territories.id, name: territories.name })
      .from(userTerritoryAssignments)
      .innerJoin(territories, eq(territories.id, userTerritoryAssignments.territoryId))
      .where(
        and(
          eq(userTerritoryAssignments.userId, params.userId),
          eq(territories.verticalId, params.verticalId)
        )
      );

    if (heldTerritories.length > 0) {
      const names = heldTerritories.map((t) => t.name).join(", ");
      throw new OperationNotAllowedError(
        "revoke_vertical",
        `User still holds ${heldTerritories.length} territory/territories in this vertical (${names}). Remove those assignments first.`
      );
    }

    await db
      .delete(userVerticalAssignments)
      .where(
        and(
          eq(userVerticalAssignments.userId, params.userId),
          eq(userVerticalAssignments.verticalId, params.verticalId)
        )
      );
  }

  async findVerticalAssignmentsByUserId(userId: number): Promise<
    Array<{ verticalId: number; managerId: number | null; assignedAt: Date }>
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
    userId: number;
    assignedByUserId: number;
    verticalAssignments: Array<{
      verticalId: number;
      territoryIds: number[];
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

  async listActiveVerticals(): Promise<Array<{ id: number; code: string; name: string }>> {
    const rows = await db
      .select({ id: businessVerticals.id, code: businessVerticals.code, name: businessVerticals.name })
      .from(businessVerticals)
      .where(eq(businessVerticals.isActive, true))
      .orderBy(businessVerticals.name);

    return rows;
  }
}
