import { db } from "../infrastructure/database/db";
import { users } from "@atlasmed/database";

export async function isIntegrationDatabaseReady(): Promise<boolean> {
  try {
    await db.select({ managerId: users.managerId }).from(users).limit(1);
    return true;
  } catch (error) {
    return false;
  }
}

export function assertIntegrationDatabaseReady(dbReady: boolean): void {
  if (!dbReady) {
    throw new Error(
      "Test DB not ready — cannot run integration tests. Ensure DATABASE_URL points to a migrated PostgreSQL instance."
    );
  }
}
