import { afterAll } from "bun:test";
import { redis } from "./infrastructure/cache/redis.client";

/**
 * Global test teardown
 * Runs once after all tests
 *
 * NOTE: no database seeding happens here. API tests are unit-only for now;
 * integration fixtures will return when that suite is redesigned.
 */
afterAll(async () => {
  console.log("\n🧹 Cleaning up test environment...\n");

  try {
    await redis.quit();
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
});
