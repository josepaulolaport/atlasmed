import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { hash } from "argon2";
import { eq, inArray } from "drizzle-orm";
import { Role } from "@atlasmed/access";
import {
  roles,
  territories,
  territoryClosure,
  territoryTypes,
  userTerritoryAssignments,
  users,
} from "@atlasmed/database";
import { db } from "../../../../infrastructure/database/db";
import { OperationNotAllowedError } from "../../../../shared/errors";
import { DrizzleTerritoryClosureRepository } from "../../infrastructure/repositories/drizzle/drizzle-territory-closure.repository";
import { TerritoryAssignmentPolicyService } from "./territory-assignment-policy.service";

// Exercises `validateAssignment` against the real database for the parts
// that read directly from `db` (the conflicting-assignments scan and the
// closure-table overlap check) rather than mocking them away — that's
// exactly the code path the N+1 -> single-batched-query fix touches.
describe("TerritoryAssignmentPolicyService", () => {
  const suffix = `polcy${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  let typeId: string;
  let territoryAId: string;
  let territoryBId: string;
  let territoryCId: string;
  let userAId: string;
  let userBId: string;
  let userDId: string;
  let userEId: string;
  let repRoleId: string;

  function fakeTerritoryFor(territoryId: string) {
    return {
      territoryRepository: {
        findById: mock(async () => ({
          id: territoryId,
          isActive: true,
          territoryTypeId: typeId,
          territoryType: {
            slug: `${suffix}-type`,
            assignsClinics: true,
            assignableToUsers: true,
            assignableToManagers: false,
          },
        })),
      } as never,
      territoryTypeRepository: {} as never,
    };
  }

  beforeAll(async () => {
    let repRole = await db.query.roles.findFirst({ where: eq(roles.name, "REP") });
    if (!repRole) {
      [repRole] = await db.insert(roles).values({ name: "REP", priority: 10 }).returning();
    }
    repRoleId = repRole!.id;

    const [type] = await db
      .insert(territoryTypes)
      .values({
        slug: `${suffix}-type`,
        name: "Assignment policy test patch",
        assignsClinics: true,
        assignableToUsers: true,
        assignableToManagers: false,
      })
      .returning();
    typeId = type!.id;

    const [tA, tB, tC] = await db
      .insert(territories)
      .values([
        {
          name: `Territory A ${suffix}`,
          slug: `${suffix}-a`,
          code: `${suffix}-A`,
          nodeType: "patch",
          territoryTypeId: typeId,
          countryCode: "BR",
        },
        {
          name: `Territory B ${suffix}`,
          slug: `${suffix}-b`,
          code: `${suffix}-B`,
          nodeType: "patch",
          territoryTypeId: typeId,
          countryCode: "BR",
        },
        {
          name: `Territory C ${suffix}`,
          slug: `${suffix}-c`,
          code: `${suffix}-C`,
          nodeType: "patch",
          territoryTypeId: typeId,
          countryCode: "BR",
        },
      ])
      .returning();
    territoryAId = tA!.id;
    territoryBId = tB!.id;
    territoryCId = tC!.id;

    // C is a closure descendant of A — simulates an ancestor/descendant
    // relationship the overlap check must catch. B has no closure row at
    // all relative to A, like two unrelated sibling rep patches.
    await db.insert(territoryClosure).values({
      ancestorId: territoryAId,
      descendantId: territoryCId,
      depth: 1,
    });

    const passwordHash = await hash("Password123!");
    const [userA, userB, userD, userE] = await db
      .insert(users)
      .values(
        ["a", "b", "d", "e"].map((letter) => ({
          email: `${letter}.${suffix}@test.example.com`,
          username: `${letter}_${suffix}`,
          passwordHash,
          roleId: repRoleId,
          status: "ACTIVE" as const,
          emailVerified: true,
        }))
      )
      .returning();
    userAId = userA!.id;
    userBId = userB!.id;
    userDId = userD!.id;
    userEId = userE!.id;

    // User A already holds territory A.
    await db.insert(userTerritoryAssignments).values({
      userId: userAId,
      territoryId: territoryAId,
    });
  });

  afterAll(async () => {
    await db
      .delete(userTerritoryAssignments)
      .where(
        inArray(userTerritoryAssignments.territoryId, [
          territoryAId,
          territoryBId,
          territoryCId,
        ])
      );
    await db.delete(users).where(inArray(users.id, [userAId, userBId, userDId, userEId]));
    await db.delete(territoryClosure).where(eq(territoryClosure.ancestorId, territoryAId));
    await db
      .delete(territories)
      .where(inArray(territories.id, [territoryAId, territoryBId, territoryCId]));
    await db.delete(territoryTypes).where(eq(territoryTypes.id, typeId));
  });

  it("allows the same user to be assigned a second, unrelated territory (multi-territory ownership)", async () => {
    const service = new TerritoryAssignmentPolicyService({
      ...fakeTerritoryFor(territoryBId),
      closureRepository: new DrizzleTerritoryClosureRepository(),
    });

    await expect(
      service.validateAssignment({
        targetUserId: userAId,
        targetRole: Role.REP,
        territoryId: territoryBId,
      })
    ).resolves.toBeUndefined();
  });

  it("allows a different user to take an unrelated territory", async () => {
    const service = new TerritoryAssignmentPolicyService({
      ...fakeTerritoryFor(territoryBId),
      closureRepository: new DrizzleTerritoryClosureRepository(),
    });

    await expect(
      service.validateAssignment({
        targetUserId: userBId,
        targetRole: Role.REP,
        territoryId: territoryBId,
      })
    ).resolves.toBeUndefined();
  });

  it("rejects a different user taking a territory that is an ancestor/descendant of one already held by another REP", async () => {
    const service = new TerritoryAssignmentPolicyService({
      ...fakeTerritoryFor(territoryCId),
      closureRepository: new DrizzleTerritoryClosureRepository(),
    });

    await expect(
      service.validateAssignment({
        targetUserId: userBId,
        targetRole: Role.REP,
        territoryId: territoryCId,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });

  it("allows the SAME user to take that related territory too — self-overlap is not blocked", async () => {
    const service = new TerritoryAssignmentPolicyService({
      ...fakeTerritoryFor(territoryCId),
      closureRepository: new DrizzleTerritoryClosureRepository(),
    });

    await expect(
      service.validateAssignment({
        targetUserId: userAId,
        targetRole: Role.REP,
        territoryId: territoryCId,
      })
    ).resolves.toBeUndefined();
  });

  it("rejects a different user taking the exact same territory already held by another REP", async () => {
    const service = new TerritoryAssignmentPolicyService({
      ...fakeTerritoryFor(territoryAId),
      closureRepository: new DrizzleTerritoryClosureRepository(),
    });

    await expect(
      service.validateAssignment({
        targetUserId: userBId,
        targetRole: Role.REP,
        territoryId: territoryAId,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });

  it("does a single batched closure check no matter how many other REP assignments exist (no N+1)", async () => {
    // Give three more REP users a conflicting-role assignment so there
    // are several rows for the "conflicting assignments" scan to find.
    await db.insert(userTerritoryAssignments).values([
      { userId: userBId, territoryId: territoryBId },
      { userId: userDId, territoryId: territoryBId },
      { userId: userEId, territoryId: territoryBId },
    ]);

    const hasAnyAncestorDescendantRelation = mock(async () => false);
    const service = new TerritoryAssignmentPolicyService({
      ...fakeTerritoryFor(territoryCId),
      closureRepository: { hasAnyAncestorDescendantRelation } as never,
    });

    await service.validateAssignment({
      targetUserId: userAId,
      targetRole: Role.REP,
      territoryId: territoryCId,
    });

    expect(hasAnyAncestorDescendantRelation).toHaveBeenCalledTimes(1);

    await db
      .delete(userTerritoryAssignments)
      .where(
        inArray(userTerritoryAssignments.userId, [userBId, userDId, userEId])
      );
  });

  it("skips the closure check entirely when there are no conflicting assignments", async () => {
    // At this point user A's own territory-A assignment is the only row
    // left in the table (the previous test cleaned up B/D/E's) — using
    // user A as the target excludes that row too, leaving zero
    // conflicting assignments from any *other* REP.
    const hasAnyAncestorDescendantRelation = mock(async () => false);
    const service = new TerritoryAssignmentPolicyService({
      ...fakeTerritoryFor(territoryBId),
      closureRepository: { hasAnyAncestorDescendantRelation } as never,
    });

    await service.validateAssignment({
      targetUserId: userAId,
      targetRole: Role.REP,
      territoryId: territoryBId,
    });

    expect(hasAnyAncestorDescendantRelation).not.toHaveBeenCalled();
  });
});
