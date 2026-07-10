import { beforeAll, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cnesRuns, cnesDiffs, cnesSuggestions, facilities } from "@atlasmed/database";
import { eq, and, sql } from "drizzle-orm";

function loadApiEnv(): void {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envPath = resolve(import.meta.dir, "../../../api/.env");
  try {
    const contents = readFileSync(envPath, "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }
      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1).replace(/^"|"$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Local .env is optional — CI provides DATABASE_URL via workflow env.
  }
}

async function isWorkerDatabaseReady(): Promise<boolean> {
  try {
    const { db } = await import("../src/infrastructure/db");
    await db.execute(sql`SELECT 1`);
    const rows = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'registry_staging' AND table_name = 'facilities'
      ) AS exists
    `);
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

describe("CNES ingestion worker Integration Tests", () => {
  let dbReady = false;

  beforeAll(async () => {
    loadApiEnv();
    dbReady = await isWorkerDatabaseReady();
  });

  it("discover activity sets reference on ingestion run", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const { db } = await import("../src/infrastructure/db");
    const { discoverLatestReferenceActivity } = await import(
      "../src/activities/discover-download.activities"
    );

    const [run] = await db
      .insert(cnesRuns)
      .values({ sourceProvider: "cnes", status: "RUNNING" })
      .returning();

    const reference = await discoverLatestReferenceActivity({
      ingestionRunId: run!.id,
      ano: 2026,
      mes: 1,
    });

    expect(reference).toEqual({ ano: 2026, mes: 1 });

    const [updated] = await db
      .select()
      .from(cnesRuns)
      .where(eq(cnesRuns.id, run!.id))
      .limit(1);
    expect(updated?.phase).toBe("DISCOVERING");
    expect(updated?.referenceAno).toBe(2026);
    expect(updated?.referenceMes).toBe(1);

    await db.delete(cnesRuns).where(eq(cnesRuns.id, run!.id));
  });

  it("validation fails when staging facilities table is empty", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const { db } = await import("../src/infrastructure/db");
    const { truncateRegistryStaging } = await import("../src/infrastructure/registry-schemas");
    const { validateStagingActivity } = await import(
      "../src/activities/load-validate-promote.activities"
    );

    await truncateRegistryStaging();

    const [run] = await db
      .insert(cnesRuns)
      .values({ sourceProvider: "cnes", status: "RUNNING" })
      .returning();

    await expect(validateStagingActivity({ ingestionRunId: run!.id })).rejects.toThrow(
      /Staging validation failed/
    );

    await db.delete(cnesRuns).where(eq(cnesRuns.id, run!.id));
  });

  it("reconcile creates facility shell from minimal staging row", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const { db } = await import("../src/infrastructure/db");
    const { truncateRegistryStaging } = await import("../src/infrastructure/registry-schemas");
    const { reconcileCrmDiffActivity } = await import(
      "../src/activities/reconcile-sync.activities"
    );

    await truncateRegistryStaging();

    const [run] = await db
      .insert(cnesRuns)
      .values({ sourceProvider: "cnes", status: "RUNNING" })
      .returning();

    const facilityId = `test-facility-${run!.id}`;
    await db.execute(sql`
      INSERT INTO registry_staging.facilities (
        facility_id, legal_name, trade_name, street_address, latitude, longitude
      ) VALUES (
        ${facilityId}, 'Test Legal', 'Test Trade', 'Rua Test 1', -23.5, -46.6
      )
    `);

    const stats = await reconcileCrmDiffActivity({ ingestionRunId: run!.id });

    expect(stats.facilitiesCreated).toBe(1);

    await db
      .delete(facilities)
      .where(
        and(
          eq(facilities.externalSourceId, facilityId),
          eq(facilities.sourceProvider, "cnes")
        )
      );
    await db.delete(cnesDiffs).where(eq(cnesDiffs.cnesRunId, run!.id));
    await db.delete(cnesSuggestions).where(eq(cnesSuggestions.cnesRunId, run!.id));
    await db.delete(cnesRuns).where(eq(cnesRuns.id, run!.id));
  });
});
