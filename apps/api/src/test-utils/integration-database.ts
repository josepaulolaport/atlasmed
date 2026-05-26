import { prisma } from "../infrastructure/database/prisma.client";

export async function isIntegrationDatabaseReady(): Promise<boolean> {
  try {
    await prisma.user.findFirst({
      select: { managerId: true },
      take: 1,
    });
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
