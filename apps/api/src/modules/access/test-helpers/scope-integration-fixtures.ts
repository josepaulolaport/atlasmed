import { hash } from "argon2";
import { prisma } from "../../../infrastructure/database/prisma.client";
import { ROLE_PRIORITY_BY_NAME } from "../application/constants/role-priority.constants";
import { TerritoryClosureService } from "../../territory/application/services/territory-closure.service";
import { PrismaTerritoryRepository } from "../../territory/infrastructure/repositories/prisma/prisma-territory.repository";
import { PrismaTerritoryClosureRepository } from "../../territory/infrastructure/repositories/prisma/prisma-territory-closure.repository";

const TEST_PASSWORD = "Password123!";

export interface ScopeIntegrationFixtures {
  uniqueId: string;
  territoryId: string;
  extraTerritoryId: string;
  outOfScopeTerritoryId: string;
  admin: { id: string; email: string; token?: string };
  manager: { id: string; email: string };
  otherManager: { id: string; email: string };
  fieldUser: { id: string; email: string };
  otherUser: { id: string; email: string };
  password: string;
}

async function rebuildClosure(territoryId: string): Promise<void> {
  const closureService = new TerritoryClosureService({
    territoryRepository: new PrismaTerritoryRepository(),
    closureRepository: new PrismaTerritoryClosureRepository(),
  });
  await closureService.rebuildSubtree(territoryId);
}

export async function seedScopeIntegrationFixtures(
  uniqueId: string
): Promise<ScopeIntegrationFixtures> {
  const passwordHash = await hash(TEST_PASSWORD);
  const codeSuffix = uniqueId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();

  const root = await prisma.territory.create({
    data: {
      name: `Brazil ${uniqueId}`,
      slug: `br-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}`,
      nodeType: "region",
      territoryTypeId: "tt_country",
      countryCode: "BR",
      regionSlug: "BR",
    },
  });
  await rebuildClosure(root.id);

  const region = await prisma.territory.create({
    data: {
      name: `Region ${uniqueId}`,
      slug: `se-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-SE`,
      nodeType: "region",
      territoryTypeId: "tt_region",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: root.id,
    },
  });
  await rebuildClosure(region.id);

  const patch = await prisma.territory.create({
    data: {
      name: `Patch ${uniqueId}`,
      slug: `patch-01-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-SE-01`,
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: region.id,
    },
  });
  await rebuildClosure(patch.id);

  const extraPatch = await prisma.territory.create({
    data: {
      name: `Patch Extra ${uniqueId}`,
      slug: `patch-02-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-SE-02`,
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "SE",
      parentId: region.id,
    },
  });
  await rebuildClosure(extraPatch.id);

  const otherRegion = await prisma.territory.create({
    data: {
      name: `Region North ${uniqueId}`,
      slug: `n-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-N`,
      nodeType: "region",
      territoryTypeId: "tt_region",
      countryCode: "BR",
      regionSlug: "N",
      parentId: root.id,
    },
  });
  await rebuildClosure(otherRegion.id);

  const outOfScopePatch = await prisma.territory.create({
    data: {
      name: `Patch North ${uniqueId}`,
      slug: `patch-n-01-${codeSuffix.toLowerCase()}`,
      code: `BR-${codeSuffix}-N-01`,
      nodeType: "patch",
      territoryTypeId: "tt_patch",
      countryCode: "BR",
      regionSlug: "N",
      parentId: otherRegion.id,
    },
  });
  await rebuildClosure(outOfScopePatch.id);

  const territoryId = patch.id;
  const extraTerritoryId = extraPatch.id;
  const outOfScopeTerritoryId = outOfScopePatch.id;

  const [adminRole, managerRole, userRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: "ADMIN" },
      update: { priority: ROLE_PRIORITY_BY_NAME.ADMIN },
      create: {
        name: "ADMIN",
        description: "Administrator",
        priority: ROLE_PRIORITY_BY_NAME.ADMIN,
      },
    }),
    prisma.role.upsert({
      where: { name: "MANAGER" },
      update: { priority: ROLE_PRIORITY_BY_NAME.MANAGER },
      create: {
        name: "MANAGER",
        description: "Manager",
        priority: ROLE_PRIORITY_BY_NAME.MANAGER,
      },
    }),
    prisma.role.upsert({
      where: { name: "USER" },
      update: { priority: ROLE_PRIORITY_BY_NAME.USER },
      create: {
        name: "USER",
        description: "Regular user",
        priority: ROLE_PRIORITY_BY_NAME.USER,
      },
    }),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: `admin.scope.${uniqueId}@test.example.com`,
      username: `admin_scope_${uniqueId}`,
      passwordHash,
      roleId: adminRole.id,
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: `manager.scope.${uniqueId}@test.example.com`,
      username: `manager_scope_${uniqueId}`,
      passwordHash,
      roleId: managerRole.id,
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  const otherManager = await prisma.user.create({
    data: {
      email: `othermanager.scope.${uniqueId}@test.example.com`,
      username: `othermanager_scope_${uniqueId}`,
      passwordHash,
      roleId: managerRole.id,
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  const fieldUser = await prisma.user.create({
    data: {
      email: `field.scope.${uniqueId}@test.example.com`,
      username: `field_scope_${uniqueId}`,
      passwordHash,
      roleId: userRole.id,
      status: "ACTIVE",
      emailVerified: true,
      managerId: manager.id,
    },
  });

  const otherUser = await prisma.user.create({
    data: {
      email: `other.scope.${uniqueId}@test.example.com`,
      username: `other_scope_${uniqueId}`,
      passwordHash,
      roleId: userRole.id,
      status: "ACTIVE",
      emailVerified: true,
      managerId: otherManager.id,
    },
  });

  await prisma.userTerritoryAssignment.create({
    data: {
      userId: fieldUser.id,
      territoryId,
      assignedBy: admin.id,
    },
  });

  return {
    uniqueId,
    territoryId,
    extraTerritoryId,
    outOfScopeTerritoryId,
    admin: { id: admin.id, email: admin.email! },
    manager: { id: manager.id, email: manager.email! },
    otherManager: { id: otherManager.id, email: otherManager.email! },
    fieldUser: { id: fieldUser.id, email: fieldUser.email! },
    otherUser: { id: otherUser.id, email: otherUser.email! },
    password: TEST_PASSWORD,
  };
}

export async function cleanupScopeIntegrationFixtures(uniqueId: string) {
  const territories = await prisma.territory.findMany({
    where: { code: { contains: uniqueId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() } },
    select: { id: true },
  });
  const territoryIds = territories.map((t) => t.id);

  if (territoryIds.length > 0) {
    await prisma.userTerritoryAssignment.deleteMany({
      where: { territoryId: { in: territoryIds } },
    });
    await prisma.territoryClosure.deleteMany({
      where: {
        OR: [
          { ancestorId: { in: territoryIds } },
          { descendantId: { in: territoryIds } },
        ],
      },
    });
    await prisma.territory.deleteMany({ where: { id: { in: territoryIds } } });
  }

  await prisma.session.deleteMany({
    where: {
      user: {
        email: { contains: `scope.${uniqueId}@test.example.com` },
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: { contains: `scope.${uniqueId}@test.example.com` },
    },
  });
}
