import { facilities, userFacilityBookmarks } from "@atlasmed/database";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityBookmarkPage,
  FacilityBookmarkRepository,
} from "../../../application/interfaces/facility-bookmark.repository.interface";
import type { ScopeContext } from "@atlasmed/access";
import type { Database } from "@atlasmed/database";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * A database handle or an open transaction. The DB-backed tests thread the
 * harness's rolled-back transaction in; a query issued against the module-level
 * `db` runs on another connection and cannot see the seeded rows. Production
 * callers pass nothing.
 */
type Executor = Database | Tx;

/**
 * An empty scope must match nothing, not everything.
 *
 * `inArray(col, [])` is a false predicate in Drizzle, but the sentinel is what
 * the rest of this module uses (`drizzle-facility.repository.ts:173`) and it
 * survives refactors that a bare empty array does not.
 */
function scopedFacilityIds(scope: ScopeContext): number[] {
  return scope.facilityIds?.length ? scope.facilityIds : [-1];
}

export class DrizzleFacilityBookmarkRepository
  implements FacilityBookmarkRepository
{
  async add(input: { userId: number; facilityId: number }, executor: Executor = db): Promise<void> {
    await executor
      .insert(userFacilityBookmarks)
      .values({ userId: input.userId, facilityId: input.facilityId })
      .onConflictDoNothing({
        target: [
          userFacilityBookmarks.userId,
          userFacilityBookmarks.facilityId,
        ],
      });
  }

  async remove(input: { userId: number; facilityId: number }, executor: Executor = db): Promise<void> {
    await executor
      .delete(userFacilityBookmarks)
      .where(
        and(
          eq(userFacilityBookmarks.userId, input.userId),
          eq(userFacilityBookmarks.facilityId, input.facilityId)
        )
      );
  }

  async listForUser(input: {
    userId: number;
    scope: ScopeContext;
    page: number;
    limit: number;
  }, executor: Executor = db): Promise<FacilityBookmarkPage> {
    /**
     * Two filters that are easy to conflate and both required:
     *
     * - `deactivated_at IS NULL` — a deactivated clinic is invisible everywhere
     *   else, so it must not resurface here. `ON DELETE CASCADE` does not cover
     *   it, because deactivation is a soft delete.
     * - scope — a clinic that left the user's territory must disappear.
     */
    const conditions = [
      eq(userFacilityBookmarks.userId, input.userId),
      isNull(facilities.deactivatedAt),
    ];
    if (!input.scope.isGlobal) {
      conditions.push(
        inArray(userFacilityBookmarks.facilityId, scopedFacilityIds(input.scope))
      );
    }
    const where = and(...conditions);

    const [rows, [counted]] = await Promise.all([
      executor
        .select({
          facilityId: userFacilityBookmarks.facilityId,
          createdAt: userFacilityBookmarks.createdAt,
        })
        .from(userFacilityBookmarks)
        .innerJoin(facilities, eq(facilities.id, userFacilityBookmarks.facilityId))
        .where(where)
        .orderBy(desc(userFacilityBookmarks.createdAt))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit),
      executor
        .select({ total: sql<number>`count(*)::int` })
        .from(userFacilityBookmarks)
        .innerJoin(facilities, eq(facilities.id, userFacilityBookmarks.facilityId))
        .where(where),
    ]);

    return { items: rows, total: Number(counted?.total ?? 0) };
  }

  async findBookmarkedIds(input: {
    userId: number;
    facilityIds: number[];
  }, executor: Executor = db): Promise<number[]> {
    if (input.facilityIds.length === 0) return [];

    const rows = await executor
      .select({ facilityId: userFacilityBookmarks.facilityId })
      .from(userFacilityBookmarks)
      .where(
        and(
          eq(userFacilityBookmarks.userId, input.userId),
          inArray(userFacilityBookmarks.facilityId, input.facilityIds)
        )
      );

    return rows.map((row) => row.facilityId);
  }
}
