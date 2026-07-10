import { hash } from "argon2";
import { eq, and, like, inArray, ne, or } from "drizzle-orm";
import {
  territories,
  roles,
  users,
  sessions,
  userTerritoryAssignments,
  facilities,
  territoryClosure,
} from "@atlasmed/database";
import { db } from "../../../infrastructure/database/db";
import { ROLE_PRIORITY_BY_NAME } from "../application/constants/role-priority.constants";
import { TerritoryClosureService } from "../../territory/application/services/territory-closure.service";
import { DrizzleTerritoryRepository } from "../../territory/infrastructure/repositories/drizzle/drizzle-territory.repository";
import { DrizzleTerritoryClosureRepository } from "../../territory/infrastructure/repositories/drizzle/drizzle-territory-closure.repository";

const TEST_PASSWORD = "Password123!";

export interface ScopeIntegrationFixtures {
  uniqueId: string;
  territoryId: string;
  extraTerritoryId: string;
  outOfScopeTerritoryId: string;
  inScopeFacilityId: string;
  outOfScopeFacilityId: string;
  admin: { id: string; email: string; token?: string };
  manager: { id: string; email: string };
  otherManager: { id: string; email: string };
  fieldUser: { id: string; email: string };
  otherUser: { id: string; email: string };
  password: string;
}

async function rebuildClosure(territoryId: string): Promise<void> {
  const closureService = new TerritoryClosureService({
    territoryRepository: new DrizzleTerritoryRepository(),
    closureRepository: new DrizzleTerritoryClosureRepository(),
  });
  await closureService.rebuildSubtree(territoryId);
}

export async function seedScopeIntegrationFixtures(
  uniqueId: string
): Promise<ScopeIntegrationFixtures> {
  const passwordHash = await hash(TEST_PASSWORD);
  const codeSuffix = uniqueId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();

  let rootOrNull = await db
    .select()
    .from(territories)
    .where(
      and(
        eq(territories.territoryTypeId, "tt_country"),
        eq(territories.countryCode, "BR"),
        eq(territories.isActive, true),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!rootOrNull) {
    rootOrNull = await db
      .insert(territories)
      .values({
        name: `Brazil ${uniqueId}`,
        slug: `br-${codeSuffix.toLowerCase()}`,
        code: `BR-${codeSuffix}`,
        nodeType: "region",
        territoryTypeId: "tt_country",
        countryCode: "BR",
        regionSlug: "BR",
      })
      .returning()
      .then((r) => r[0]!);
    await rebuildClosure(rootOrNull.id);
  }

  const root = rootOrNull;

  const region = await db
    .insert(territories)
    .values({
      name: `Region ${uniqueId}`,
      slug: `se-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-SE`,
      nodeType: "region",
      territoryTypeId: "tt_region",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: root.id,
    })
    .returning()
    .then((r) => r[0]!);
  await rebuildClosure(region.id);

  const patch = await db
    .insert(territories)
    .values({
      name: `Patch ${uniqueId}`,
      slug: `patch-01-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-SE-01`,
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: region.id,
    })
    .returning()
    .then((r) => r[0]!);
  await rebuildClosure(patch.id);

  const extraPatch = await db
    .insert(territories)
    .values({
      name: `Patch Extra ${uniqueId}`,
      slug: `patch-02-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-SE-02`,
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: region.id,
    })
    .returning()
    .then((r) => r[0]!);
  await rebuildClosure(extraPatch.id);

  const otherRegion = await db
    .insert(territories)
    .values({
      name: `Region North ${uniqueId}`,
      slug: `n-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-N`,
      nodeType: "region",
      territoryTypeId: "tt_region",
      countryCode: "BR",
      regionSlug: "N",
      parentId: root.id,
    })
    .returning()
    .then((r) => r[0]!);
  await rebuildClosure(otherRegion.id);

  const outOfScopePatch = await db
    .insert(territories)
    .values({
      name: `Patch North ${uniqueId}`,
      slug: `patch-n-01-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-N-01`,
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "N",
      parentId: otherRegion.id,
    })
    .returning()
    .then((r) => r[0]!);
  await rebuildClosure(outOfScopePatch.id);

  const territoryId = patch.id;
  const extraTerritoryId = extraPatch.id;
  const outOfScopeTerritoryId = outOfScopePatch.id;

  const [adminRole, managerRole, userRole] = await Promise.all([
    db
      .insert(roles)
      .values({
        name: "ADMIN",
        description: "Administrator",
        priority: ROLE_PRIORITY_BY_NAME.ADMIN,
      })
      .onConflictDoUpdate({
        target: roles.name,
        set: { priority: ROLE_PRIORITY_BY_NAME.ADMIN, updatedAt: new Date() },
      })
      .returning()
      .then((r) => r[0]!),
    db
      .insert(roles)
      .values({
        name: "MANAGER",
        description: "Manager",
        priority: ROLE_PRIORITY_BY_NAME.MANAGER,
      })
      .onConflictDoUpdate({
        target: roles.name,
        set: { priority: ROLE_PRIORITY_BY_NAME.MANAGER, updatedAt: new Date() },
      })
      .returning()
      .then((r) => r[0]!),
    db
      .insert(roles)
      .values({
        name: "REP",
        description: "Regular user",
        priority: ROLE_PRIORITY_BY_NAME.REP,
      })
      .onConflictDoUpdate({
        target: roles.name,
        set: { priority: ROLE_PRIORITY_BY_NAME.REP, updatedAt: new Date() },
      })
      .returning()
      .then((r) => r[0]!),
  ]);

  const admin = await db
    .insert(users)
    .values({
      email: `admin.scope.${uniqueId}@test.example.com`,
      username: `admin_scope_${uniqueId}`,
      passwordHash,
      roleId: adminRole.id,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning()
    .then((r) => r[0]!);

  const manager = await db
    .insert(users)
    .values({
      email: `manager.scope.${uniqueId}@test.example.com`,
      username: `manager_scope_${uniqueId}`,
      passwordHash,
      roleId: managerRole.id,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning()
    .then((r) => r[0]!);

  const otherManager = await db
    .insert(users)
    .values({
      email: `othermanager.scope.${uniqueId}@test.example.com`,
      username: `othermanager_scope_${uniqueId}`,
      passwordHash,
      roleId: managerRole.id,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning()
    .then((r) => r[0]!);

  const fieldUser = await db
    .insert(users)
    .values({
      email: `field.scope.${uniqueId}@test.example.com`,
      username: `field_scope_${uniqueId}`,
      passwordHash,
      roleId: userRole.id,
      status: "ACTIVE",
      emailVerified: true,
      managerId: manager.id,
    })
    .returning()
    .then((r) => r[0]!);

  const otherUser = await db
    .insert(users)
    .values({
      email: `other.scope.${uniqueId}@test.example.com`,
      username: `other_scope_${uniqueId}`,
      passwordHash,
      roleId: userRole.id,
      status: "ACTIVE",
      emailVerified: true,
      managerId: otherManager.id,
    })
    .returning()
    .then((r) => r[0]!);

  await db.insert(userTerritoryAssignments).values({
    userId: fieldUser.id,
    territoryId,
    assignedBy: admin.id,
  });

  const inScopeFacility = await db
    .insert(facilities)
    .values({
      displayName: `Scope Facility In ${uniqueId}`,
      territoryId,
    })
    .returning()
    .then((r) => r[0]!);

  const outOfScopeFacility = await db
    .insert(facilities)
    .values({
      displayName: `Scope Facility Out ${uniqueId}`,
      territoryId: outOfScopeTerritoryId,
    })
    .returning()
    .then((r) => r[0]!);

  return {
    uniqueId,
    territoryId,
    extraTerritoryId,
    outOfScopeTerritoryId,
    inScopeFacilityId: inScopeFacility.id,
    outOfScopeFacilityId: outOfScopeFacility.id,
    admin: { id: admin.id, email: admin.email! },
    manager: { id: manager.id, email: manager.email! },
    otherManager: { id: otherManager.id, email: otherManager.email! },
    fieldUser: { id: fieldUser.id, email: fieldUser.email! },
    otherUser: { id: otherUser.id, email: otherUser.email! },
    password: TEST_PASSWORD,
  };
}

export async function cleanupScopeIntegrationFixtures(uniqueId: string) {
  const codeSuffix = uniqueId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  const territoryRows = await db
    .select({ id: territories.id })
    .from(territories)
    .where(
      and(
        like(territories.code, `%${codeSuffix}%`),
        ne(territories.territoryTypeId, "tt_country"),
      ),
    );
  const territoryIds = territoryRows.map((t) => t.id);

  if (territoryIds.length > 0) {
    await db.delete(facilities).where(like(facilities.displayName, `%${uniqueId}%`));

    await db
      .delete(userTerritoryAssignments)
      .where(inArray(userTerritoryAssignments.territoryId, territoryIds));
    await db
      .delete(territoryClosure)
      .where(
        or(
          inArray(territoryClosure.ancestorId, territoryIds),
          inArray(territoryClosure.descendantId, territoryIds),
        ),
      );
    await db.delete(territories).where(inArray(territories.id, territoryIds));
  }

  const matchingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%scope.${uniqueId}@test.example.com%`));

  if (matchingUsers.length > 0) {
    await db
      .delete(sessions)
      .where(inArray(sessions.userId, matchingUsers.map((u) => u.id)));
  }

  await db.delete(users).where(like(users.email, `%scope.${uniqueId}@test.example.com%`));
}
