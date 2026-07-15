import { REGISTRY_TABLES } from '@atlasmed/cnes-ingestion'
import { sql } from 'drizzle-orm'
import { db } from './db'

async function registryTableExists(table: string): Promise<boolean> {
  const rows = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'registry' AND table_name = ${table}
    ) AS exists
  `)
  return rows[0]?.exists ?? false
}

export async function recreateRegistryStagingSchema(): Promise<void> {
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS registry_staging`)

  for (const table of REGISTRY_TABLES) {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS registry_staging.${table} CASCADE`))
    if (!(await registryTableExists(table))) {
      continue
    }
    await db.execute(
      sql.raw(`CREATE TABLE registry_staging.${table} (LIKE registry.${table} INCLUDING ALL)`)
    )
  }
}

export async function truncateRegistryStaging(): Promise<void> {
  const tableList = REGISTRY_TABLES.map((table) => `registry_staging.${table}`).join(', ')
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`))
}

export async function promoteRegistrySchemas(): Promise<void> {
  await db.execute(sql`DROP SCHEMA IF EXISTS registry_previous CASCADE`)
  await db.execute(sql`ALTER SCHEMA registry RENAME TO registry_previous`)
  await db.execute(sql`ALTER SCHEMA registry_staging RENAME TO registry`)
  await recreateRegistryStagingSchema()
}
