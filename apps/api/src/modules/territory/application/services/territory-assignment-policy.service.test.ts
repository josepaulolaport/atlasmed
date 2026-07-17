import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { hash } from "argon2";
import { eq, inArray } from "drizzle-orm";
import { Role } from "@atlasmed/access";
import { roles, territories, territoryTypes, userTerritoryAssignments, users } from "@atlasmed/database";
import { db } from "../../../../infrastructure/database/db";
import { OperationNotAllowedError } from "../../../../shared/errors";
import { TerritoryAssignmentPolicyService } from "./territory-assignment-policy.service";

describe("TerritoryAssignmentPolicyService", () => {
  const suffix = `polcy${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  let typeId: string;
  let territoryAId: string;
  let territoryBId: string;
  let userAId: string;
  let userBId: string;
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

    const [tA, tB] = await db
      .insert(territories)
      .values([
        {
          name: `Territory A ${suffix}`,
          slug: `${suffix}-a`,
          code: `${suffix}-A`,
          territoryTypeId: typeId,
        },
        {
          name: `Territory B ${suffix}`,
          slug: `${suffix}-b`,
          code: `${suffix}-B`,
          territoryTypeId: typeId,
        },
      ])
      .returning();
    territoryAId = tA!.id;
    territoryBId = tB!.id;

    const passwordHash = await hash("Password123!");
    const [userA, userB] = await db
      .insert(users)
      .values(
        ["a", "b"].map((letter) => ({
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

    // User A already holds territory A.
    await db.insert(userTerritoryAssignments).values({
      userId: userAId,
      territoryId: territoryAId,
    });
  });

  afterAll(async () => {
    await db
      .delete(userTerritoryAssignments)
      .where(inArray(userTerritoryAssignments.territoryId, [territoryAId, territoryBId]));
    await db.delete(users).where(inArray(users.id, [userAId, userBId]));
    await db.delete(territories).where(inArray(territories.id, [territoryAId, territoryBId]));
    await db.delete(territoryTypes).where(eq(territoryTypes.id, typeId));
  });

  it("allows the same user to be assigned a second, unrelated territory (multi-territory ownership)", async () => {
    const service = new TerritoryAssignmentPolicyService(fakeTerritoryFor(territoryBId));

    await expect(
      service.validateAssignment({
        targetUserId: userAId,
        targetRole: Role.REP,
        territoryId: territoryBId,
      })
    ).resolves.toBeUndefined();
  });

  it("allows a different user to take an unrelated territory", async () => {
    const service = new TerritoryAssignmentPolicyService(fakeTerritoryFor(territoryBId));

    await expect(
      service.validateAssignment({
        targetUserId: userBId,
        targetRole: Role.REP,
        territoryId: territoryBId,
      })
    ).resolves.toBeUndefined();
  });

  it("rejects a different user taking the exact same territory already held by another REP", async () => {
    const service = new TerritoryAssignmentPolicyService(fakeTerritoryFor(territoryAId));

    await expect(
      service.validateAssignment({
        targetUserId: userBId,
        targetRole: Role.REP,
        territoryId: territoryAId,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });

  it("allows the SAME user to re-take a territory they already hold — self-overlap is not blocked", async () => {
    const service = new TerritoryAssignmentPolicyService(fakeTerritoryFor(territoryAId));

    await expect(
      service.validateAssignment({
        targetUserId: userAId,
        targetRole: Role.REP,
        territoryId: territoryAId,
      })
    ).resolves.toBeUndefined();
  });
});
