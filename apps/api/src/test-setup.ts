import { afterAll } from "bun:test";
import { redis } from "./infrastructure/cache/redis.client";

/**
 * Global test teardown
 * Runs once after all tests
 *
 * NOTE: no database seeding happens here or anywhere else in the test
 * pipeline. Tests that need real database rows create and clean up their
 * own fixtures explicitly (see e.g. scope-integration-fixtures.ts).
 */
afterAll(async () => {
  console.log("\n🧹 Cleaning up test environment...\n");

  try {
    await redis.quit();
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
});
