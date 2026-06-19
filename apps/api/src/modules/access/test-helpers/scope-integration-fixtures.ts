import { hash } from "argon2";
import { prisma } from "../../../infrastructure/database/prisma.client";
import { ROLE_PRIORITY_BY_NAME } from "../application/constants/role-priority.constants";

const TEST_PASSWORD = "Password123!";

export interface ScopeIntegrationFixtures {
  uniqueId: string;
  territoryId: string;
  admin: { id: string; email: string; token?: string };
  manager: { id: string; email: string };
  otherManager: { id: string; email: string };
  fieldUser: { id: string; email: string };
  otherUser: { id: string; email: string };
  password: string;
}

export async function seedScopeIntegrationFixtures(
  uniqueId: string
): Promise<ScopeIntegrationFixtures> {
  const passwordHash = await hash(TEST_PASSWORD);
  const territoryId = `territory-test-${uniqueId}`;

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
    admin: { id: admin.id, email: admin.email! },
    manager: { id: manager.id, email: manager.email! },
    otherManager: { id: otherManager.id, email: otherManager.email! },
    fieldUser: { id: fieldUser.id, email: fieldUser.email! },
    otherUser: { id: otherUser.id, email: otherUser.email! },
    password: TEST_PASSWORD,
  };
}

export async function cleanupScopeIntegrationFixtures(uniqueId: string) {
  await prisma.userTerritoryAssignment.deleteMany({
    where: { territoryId: `territory-test-${uniqueId}` },
  });

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
