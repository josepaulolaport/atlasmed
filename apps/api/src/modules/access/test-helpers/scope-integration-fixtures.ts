import { hash } from "argon2";
import { eq, like, inArray, sql } from "drizzle-orm";
import {
  territories,
  territoryTypes,
  territoryApprovalRequests,
  roles,
  users,
  sessions,
  userTerritoryAssignments,
  facilities,
} from "@atlasmed/database";
import { db } from "../../../infrastructure/database/db";
import { ROLE_PRIORITY_BY_NAME } from "../application/constants/role-priority.constants";

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

async function findTerritoryTypeIdBySlug(slug: string): Promise<string> {
  const type = await db.query.territoryTypes.findFirst({
    where: eq(territoryTypes.slug, slug),
  });
  if (!type) {
    throw new Error(`Territory type "${slug}" not found — run migrations/seed first`);
  }
  return type.id;
}

export async function seedScopeIntegrationFixtures(
  uniqueId: string
): Promise<ScopeIntegrationFixtures> {
  const passwordHash = await hash(TEST_PASSWORD);
  const codeSuffix = uniqueId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();

  const managerZoneTypeId = await findTerritoryTypeIdBySlug("manager_zone");
  const patchTypeId = await findTerritoryTypeIdBySlug("patch");

  const zone = await db
    .insert(territories)
    .values({
      name: `Zone ${uniqueId}`,
      slug: `zone-${codeSuffix.toLowerCase()}`,
      code: `${codeSuffix}-ZONE`,
      territoryTypeId: managerZoneTypeId,
    })
    .returning()
    .then((r) => r[0]!);

  const patch = await db
    .insert(territories)
    .values({
      name: `Patch ${uniqueId}`,
      slug: `patch-01-${codeSuffix.toLowerCase()}`,
      code: `${codeSuffix}-01`,
      territoryTypeId: patchTypeId,
      managerTerritoryId: zone.id,
    })
    .returning()
    .then((r) => r[0]!);

  const extraPatch = await db
    .insert(territories)
    .values({
      name: `Patch Extra ${uniqueId}`,
      slug: `patch-02-${codeSuffix.toLowerCase()}`,
      code: `${codeSuffix}-02`,
      territoryTypeId: patchTypeId,
      managerTerritoryId: zone.id,
    })
    .returning()
    .then((r) => r[0]!);

  const otherZone = await db
    .insert(territories)
    .values({
      name: `Zone North ${uniqueId}`,
      slug: `zone-n-${codeSuffix.toLowerCase()}`,
      code: `${codeSuffix}-N-ZONE`,
      territoryTypeId: managerZoneTypeId,
    })
    .returning()
    .then((r) => r[0]!);

  const outOfScopePatch = await db
    .insert(territories)
    .values({
      name: `Patch North ${uniqueId}`,
      slug: `patch-n-01-${codeSuffix.toLowerCase()}`,
      code: `${codeSuffix}-N-01`,
      territoryTypeId: patchTypeId,
      managerTerritoryId: otherZone.id,
    })
    .returning()
    .then((r) => r[0]!);

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
      streetAddress: "Rua Teste",
      streetNumber: "100",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      postalCode: "01000-000",
      phoneNumber: "1133334444",
      email: `facility.in.${uniqueId}@test.example.com`,
      websiteUrl: "https://example.com/facility",
      location: sql`ST_SetSRID(ST_MakePoint(${-46.6333}, ${-23.5505}), 4326)`,
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
    .where(like(territories.code, `%${codeSuffix}%`));
  const territoryIds = territoryRows.map((t) => t.id);

  if (territoryIds.length > 0) {
    await db.delete(facilities).where(like(facilities.displayName, `%${uniqueId}%`));

    await db
      .delete(userTerritoryAssignments)
      .where(inArray(userTerritoryAssignments.territoryId, territoryIds));
    await db
      .delete(territoryApprovalRequests)
      .where(inArray(territoryApprovalRequests.targetTerritoryId, territoryIds));
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
