import { beforeAll, afterAll } from "bun:test";
import { seedTestDatabase, cleanupTestDatabase } from "./infrastructure/database/test-seed";
import { prisma } from "./infrastructure/database/prisma.client";
import { redis } from "./infrastructure/cache/redis.client";

/**
 * Global test setup
 * Runs once before all tests
 */
beforeAll(async () => {
  console.log("\n🧪 Setting up test environment...\n");

  try {
    // Seed test database
    await seedTestDatabase();
  } catch (error) {
    console.error("Failed to setup test environment:", error);
    throw error;
  }
});

/**
 * Global test teardown
 * Runs once after all tests
 */
afterAll(async () => {
  console.log("\n🧹 Cleaning up test environment...\n");

  try {
    // Close connections
    await prisma.$disconnect();
    await redis.quit();
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
});
