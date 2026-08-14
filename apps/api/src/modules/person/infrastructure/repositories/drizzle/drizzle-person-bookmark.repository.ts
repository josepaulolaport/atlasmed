import { personFacilities, persons, userPersonBookmarks } from "@atlasmed/database";
import { and, desc, eq, exists, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  PersonBookmarkPage,
  PersonBookmarkRepository,
} from "../../../application/interfaces/person-bookmark.repository.interface";
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

/** Empty scope matches nothing, not everything. */
function scopedFacilityIds(scope: ScopeContext): number[] {
  return scope.facilityIds?.length ? scope.facilityIds : [-1];
}

export class DrizzlePersonBookmarkRepository implements PersonBookmarkRepository {
  async findActivePersonById(
    personId: number,
    executor: Executor = db
  ): Promise<{ id: number } | null> {
    const [row] = await executor
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async isPersonInScope(
    input: { personId: number; scope: ScopeContext },
    executor: Executor = db
  ): Promise<boolean> {
    if (input.scope.isGlobal) return true;

    const [row] = await executor
      .select({ one: sql<number>`1` })
      .from(personFacilities)
      .where(
        and(
          eq(personFacilities.personId, input.personId),
          inArray(personFacilities.facilityId, scopedFacilityIds(input.scope))
        )
      )
      .limit(1);
    return row != null;
  }

  async add(input: { userId: number; personId: number }, executor: Executor = db): Promise<void> {
    await executor
      .insert(userPersonBookmarks)
      .values({ userId: input.userId, personId: input.personId })
      .onConflictDoNothing({
        target: [userPersonBookmarks.userId, userPersonBookmarks.personId],
      });
  }

  async remove(input: { userId: number; personId: number }, executor: Executor = db): Promise<void> {
    await executor
      .delete(userPersonBookmarks)
      .where(
        and(
          eq(userPersonBookmarks.userId, input.userId),
          eq(userPersonBookmarks.personId, input.personId)
        )
      );
  }

  async listForUser(input: {
    userId: number;
    scope: ScopeContext;
    page: number;
    limit: number;
  }, executor: Executor = db): Promise<PersonBookmarkPage> {
    /**
     * `deleted_at IS NULL` matters for the same reason the facility list checks
     * `deactivated_at`: `persons` is soft-deleted, so the foreign key's
     * `ON DELETE CASCADE` never fires and a removed doctor would otherwise
     * linger in one user's saved list.
     */
    const conditions = [
      eq(userPersonBookmarks.userId, input.userId),
      isNull(persons.deletedAt),
    ];

    if (!input.scope.isGlobal) {
      /**
       * EXISTS rather than a join: a doctor attached to several in-scope
       * clinics would otherwise be returned once per clinic, which would both
       * duplicate rows and inflate `total`.
       */
      conditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(personFacilities)
            .where(
              and(
                eq(personFacilities.personId, userPersonBookmarks.personId),
                inArray(
                  personFacilities.facilityId,
                  scopedFacilityIds(input.scope)
                )
              )
            )
        )
      );
    }
    const where = and(...conditions);

    const [rows, [counted]] = await Promise.all([
      executor
        .select({
          personId: userPersonBookmarks.personId,
          createdAt: userPersonBookmarks.createdAt,
        })
        .from(userPersonBookmarks)
        .innerJoin(persons, eq(persons.id, userPersonBookmarks.personId))
        .where(where)
        .orderBy(desc(userPersonBookmarks.createdAt))
        .limit(input.limit)
        .offset((input.page - 1) * input.limit),
      executor
        .select({ total: sql<number>`count(*)::int` })
        .from(userPersonBookmarks)
        .innerJoin(persons, eq(persons.id, userPersonBookmarks.personId))
        .where(where),
    ]);

    return { items: rows, total: Number(counted?.total ?? 0) };
  }

  async findBookmarkedIds(input: {
    userId: number;
    personIds: number[];
  }, executor: Executor = db): Promise<number[]> {
    if (input.personIds.length === 0) return [];

    const rows = await executor
      .select({ personId: userPersonBookmarks.personId })
      .from(userPersonBookmarks)
      .where(
        and(
          eq(userPersonBookmarks.userId, input.userId),
          inArray(userPersonBookmarks.personId, input.personIds)
        )
      );

    return rows.map((row) => row.personId);
  }
}
