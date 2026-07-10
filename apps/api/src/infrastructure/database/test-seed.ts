import { createDatabase } from "@atlasmed/database";
import { roles, users, sessions, invitations, passwordResets } from "@atlasmed/database";
import { eq, like } from "drizzle-orm";
import { hash } from "argon2";
import { ROLE_PRIORITY_BY_NAME } from "../../modules/access/application/constants/role-priority.constants";

/**
 * Get Drizzle client for test environment
 * Uses DATABASE_URL from environment (should point to test database)
 */
function getTestDatabase() {
  const connectionString = process.env.DATABASE_URL || "";

  if (!connectionString.includes("test")) {
    console.warn("⚠️  Warning: DATABASE_URL doesn't contain 'test'. Make sure you're using the test database!");
  }

  return createDatabase(connectionString);
}

/**
 * Test database seeding
 * Creates minimal data needed for integration tests
 */
export async function seedTestDatabase() {
  const db = getTestDatabase();

  try {
    console.log("🌱 Seeding test database...");

    await cleanupTestDatabase();

    const roleDefs = [
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

    for (const role of roleDefs) {
      await db
        .insert(roles)
        .values(role)
        .onConflictDoUpdate({
          target: roles.name,
          set: { description: role.description, priority: role.priority, updatedAt: new Date() },
        });
    }

    const userRole = await db.query.roles.findFirst({
      where: eq(roles.name, "USER"),
    });

    if (!userRole) {
      throw new Error("USER role not found");
    }

    const testPasswordHash = await hash("Password123!");

    const existingTestUser = await db.query.users.findFirst({
      where: eq(users.email, "test@example.com"),
    });

    if (existingTestUser) {
      await db
        .update(users)
        .set({
          username: "testseeduser",
          passwordHash: testPasswordHash,
          status: "ACTIVE",
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingTestUser.id));
    } else {
      await db.insert(users).values({
        email: "test@example.com",
        username: "testseeduser",
        passwordHash: testPasswordHash,
        firstName: "Test",
        lastName: "User",
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      });
    }

    console.log("✅ Test database seeded");
  } finally {
    await db.$client.end();
  }
}

/**
 * Clean up test data
 */
export async function cleanupTestDatabase() {
  const db = getTestDatabase();

  try {
    await db.delete(sessions);
    await db.delete(invitations);
    await db.delete(passwordResets);
    await db.delete(users).where(like(users.email, "%test%"));
  } finally {
    await db.$client.end();
  }
}

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
