import { REGISTRY_TABLES } from "@atlasmed/cnes-ingestion";
import { prisma } from "../infrastructure/prisma";

export async function recreateRegistryStagingSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS registry_staging`);

  for (const table of REGISTRY_TABLES) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS registry_staging.${table} CASCADE`);
    await prisma.$executeRawUnsafe(
      `CREATE TABLE registry_staging.${table} (LIKE registry.${table} INCLUDING ALL)`
    );
  }
}

export async function truncateRegistryStaging(): Promise<void> {
  const tableList = REGISTRY_TABLES.map((table) => `registry_staging.${table}`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

export async function promoteRegistrySchemas(): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS registry_previous CASCADE`);
  await prisma.$executeRawUnsafe(`ALTER SCHEMA registry RENAME TO registry_previous`);
  await prisma.$executeRawUnsafe(`ALTER SCHEMA registry_staging RENAME TO registry`);
  await recreateRegistryStagingSchema();
}
