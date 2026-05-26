import { PrismaClient } from "@atlasmed/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "argon2";
import { ROLE_PRIORITY_BY_NAME } from "../../modules/access/application/constants/role-priority.constants";

/**
 * Get Prisma client for test environment
 * Uses DATABASE_URL from environment (should point to test database)
 */
function getTestPrismaClient() {
  const connectionString = process.env.DATABASE_URL || "";
  
  if (!connectionString.includes("test")) {
    console.warn("⚠️  Warning: DATABASE_URL doesn't contain 'test'. Make sure you're using the test database!");
  }
  
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Test database seeding
 * Creates minimal data needed for integration tests
 */
export async function seedTestDatabase() {
  const prisma = getTestPrismaClient();
  
  try {
    console.log("🌱 Seeding test database...");

    // 0. Clean up any test data first
    await cleanupTestDatabase();

    // 1. Create roles
    const roles = [
      {
        name: "ADMIN",
        description: "Administrator",
        priority: ROLE_PRIORITY_BY_NAME.ADMIN,
      },
      {
        name: "MANAGER",
        description: "Manager",
        priority: ROLE_PRIORITY_BY_NAME.MANAGER,
      },
      {
        name: "USER",
        description: "Regular user",
        priority: ROLE_PRIORITY_BY_NAME.USER,
      },
    ];

    for (const role of roles) {
      await prisma.role.upsert({
        where: { name: role.name },
        update: {
          description: role.description,
          priority: role.priority,
        },
        create: role,
      });
    }

    // 2. Create test user with known password
    const userRole = await prisma.role.findUnique({
      where: { name: "USER" },
    });

    if (!userRole) {
      throw new Error("USER role not found");
    }

    const testPasswordHash = await hash("Password123!");

    // First, try to find and update existing test user
    const existingTestUser = await prisma.user.findUnique({
      where: { email: "test@example.com" },
    });

    if (existingTestUser) {
      await prisma.user.update({
        where: { id: existingTestUser.id },
        data: {
          username: "testseeduser",
          passwordHash: testPasswordHash,
          status: "ACTIVE",
          emailVerified: true,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email: "test@example.com",
          username: "testseeduser",
          passwordHash: testPasswordHash,
          firstName: "Test",
          lastName: "User",
          roleId: userRole.id,
          status: "ACTIVE",
          emailVerified: true,
        },
      });
    }

    console.log("✅ Test database seeded");
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Clean up test data
 */
export async function cleanupTestDatabase() {
  const prisma = getTestPrismaClient();
  
  try {
    // Delete in reverse order of dependencies
    await prisma.session.deleteMany({});
    await prisma.invitation.deleteMany({});
    await prisma.passwordReset.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "test",
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.main) {
  seedTestDatabase()
    .then(() => {
      console.log("✅ Test seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Test seed failed:", error);
      process.exit(1);
    });
}
