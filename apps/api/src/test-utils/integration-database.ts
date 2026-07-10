import { db } from "../infrastructure/database/db";
import { users } from "@atlasmed/database";

export async function isIntegrationDatabaseReady(): Promise<boolean> {
  try {
    await db.select({ managerId: users.managerId }).from(users).limit(1);
    return true;
  } catch (error) {
    console.warn(
      "Skipping integration tests: database schema is unavailable or not migrated.",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

export function skipIntegrationTest(dbReady: boolean): boolean {
  return !dbReady;
}
