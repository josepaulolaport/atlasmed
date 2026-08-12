import { describe, expect, test } from "bun:test";
import { isDatabaseReachable } from "../../../../../test-utils/db-harness";
import { DrizzleScopeRepository } from "./drizzle-scope.repository";

/**
 * `findManagedUserIds` must return **numbers**.
 *
 * It is a raw `db.execute`, and `users.id` is a bigint, so postgres-js hands
 * the value back as a string. The declared return type is `Promise<number[]>`
 * and the cast inside said `Array<{ id: number }>` — neither converts anything,
 * so the promise was quietly broken.
 *
 * Nothing noticed for as long as every consumer fed the ids back into SQL,
 * where `'4'` and `4` compare equal. The first one to compare in JavaScript
 * found it: `resolveSubject` asks `managedUserIds.includes(subjectUserId)`,
 * which is `['4','5','6'].includes(4)` — false — so a manager sorting Equipe by
 * any metric was refused their own reps with a 403.
 *
 * This asserts the element type rather than the ids themselves: which reps a
 * manager has is data, but "these are numbers" is the contract every caller
 * relies on.
 */
const dbUp = await isDatabaseReachable();

describe.skipIf(!dbUp)("findManagedUserIds (database)", () => {
  test("returns numeric ids, never the bigint strings postgres sends", async () => {
    const repository = new DrizzleScopeRepository();

    // Sweep the low id range rather than seeding: the query is cheap, and a
    // fixture here would be one more thing to keep in step with the territory
    // data this depends on.
    const ids: number[] = [];
    for (let userId = 1; userId <= 20; userId += 1) {
      ids.push(...(await repository.findManagedUserIds(userId)));
    }

    for (const id of ids) {
      expect(typeof id).toBe("number");
      expect(Number.isInteger(id)).toBe(true);
    }

    // A database with no manager holding a zone yields nothing, and the loop
    // above proves nothing then. Say so rather than reporting a false pass.
    if (ids.length === 0) {
      console.warn(
        "findManagedUserIds returned no rows — no manager holds a zone in this database, so the type assertion above was vacuous.",
      );
    }
  });
});
