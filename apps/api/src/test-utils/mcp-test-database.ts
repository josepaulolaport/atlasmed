import { prisma } from "../infrastructure/database/prisma.client";

export async function isMcpTestSchemaReady(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'mcp_test'
          AND table_name = 'facility_search_view'
      ) AS exists
    `;

    return rows[0]?.exists === true;
  } catch (error) {
    console.warn(
      "Skipping mcp_test integration tests: schema unavailable.",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
