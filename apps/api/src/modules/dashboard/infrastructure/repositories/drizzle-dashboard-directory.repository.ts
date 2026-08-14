import { and, eq, sql } from "drizzle-orm";
import {
  roles,
  territories,
  territoryTypes,
  userTerritoryAssignments,
  users,
} from "@atlasmed/database";
import { db } from "../../../../infrastructure/database/db";
import type {
  DashboardDirectoryPort,
  DashboardSubject,
} from "../../application/dashboard-query";

/** Kept local, as `drizzle-scope.repository.ts` does, to avoid a composition cycle. */
const MANAGER_ZONE_TYPE_SLUG = "manager_zone";

export class DrizzleDashboardDirectoryRepository
  implements DashboardDirectoryPort
{
  async findUser(userId: number): Promise<DashboardSubject | null> {
    const [row] = await db
      .select({ id: users.id, roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(and(eq(users.id, userId), sql`${users.deletedAt} IS NULL`))
      .limit(1);

    return row ? { userId: row.id, roleName: row.roleName } : null;
  }

  /**
   * The manager's zones **in this vertical**.
   *
   * Filtered by vertical rather than taking every zone the user holds: a
   * manager may run Ortopedia in one region and nothing in Estética, and a
   * dashboard that mixed them would be the cross-linha aggregate spec 0014 §3
   * exists to remove.
   */
  async findManagerZoneIds(input: {
    userId: number;
    verticalId: number;
  }): Promise<number[]> {
    const rows = await db
      .select({ id: territories.id })
      .from(userTerritoryAssignments)
      .innerJoin(
        territories,
        eq(territories.id, userTerritoryAssignments.territoryId),
      )
      .innerJoin(
        territoryTypes,
        eq(territoryTypes.id, territories.territoryTypeId),
      )
      .where(
        and(
          eq(userTerritoryAssignments.userId, input.userId),
          eq(territories.verticalId, input.verticalId),
          eq(territories.isActive, true),
          eq(territoryTypes.slug, MANAGER_ZONE_TYPE_SLUG),
        ),
      );

    return rows.map((row) => row.id);
  }

  /**
   * REPs holding a patch under this manager's zones.
   *
   * Delegates to the scope repository so "who reports to whom" has one
   * definition. It is territory-derived, not `users.manager_id` — a rep may
   * hold patches under two managers.
   */
  async findManagedUserIds(managerId: number): Promise<number[]> {
    const { accessRepositories } = await import("../../../access/composition");
    return accessRepositories.scope.findManagedUserIds(managerId);
  }
}
