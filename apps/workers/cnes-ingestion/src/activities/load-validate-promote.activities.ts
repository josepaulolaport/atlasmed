import { REGISTRY_TABLES, type RegistryTableName } from "@atlasmed/cnes-ingestion";
import { prisma } from "../infrastructure/prisma";
import { loadWorkerConfig } from "../config";
import { truncateRegistryStaging } from "../infrastructure/registry-schemas";
import { updateIngestionRunPhase } from "./discover-download.activities";

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<number>
): Promise<number> {
  let index = 0;
  let total = 0;

  async function runWorker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      total += await worker(items[current]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );
  await Promise.all(workers);
  return total;
}

export async function loadRegistryStagingActivity(input: {
  ingestionRunId: string;
  ano?: number;
  mes?: number;
  extractPath?: string;
}): Promise<{ tablesLoaded: number | string; totalRows?: number; exitCode?: number }> {
  const config = loadWorkerConfig();

  if (config.loadMode === "ftp") {
    if (!input.ano || !input.mes || !input.extractPath) {
      throw new Error("FTP load mode requires ano, mes, and extractPath");
    }

    const { loadRegistryStagingViaPythonActivity } = await import(
      "./python-staging-load.activities"
    );
    return loadRegistryStagingViaPythonActivity({
      ingestionRunId: input.ingestionRunId,
      ano: input.ano,
      mes: input.mes,
      extractPath: input.extractPath,
    });
  }

  await updateIngestionRunPhase(input.ingestionRunId, "LOADING");

  const sourceSchema = config.devLoadSourceSchema;

  await truncateRegistryStaging();

  const totalRows = await mapWithConcurrency(
    REGISTRY_TABLES,
    config.loadConcurrency,
    async (table: RegistryTableName) => {
      const inserted = await prisma.$executeRawUnsafe(`
        INSERT INTO registry_staging.${table}
        SELECT * FROM ${sourceSchema}.${table}
      `);
      return Number(inserted);
    }
  );

  return { tablesLoaded: REGISTRY_TABLES.length, totalRows };
}

interface ValidationReport {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; details?: Record<string, unknown> }>;
}

export async function validateStagingActivity(input: {
  ingestionRunId: string;
}): Promise<ValidationReport> {
  await updateIngestionRunPhase(input.ingestionRunId, "VALIDATING");

  const config = loadWorkerConfig();
  const checks: ValidationReport["checks"] = [];

  const emptyTables: string[] = [];
  for (const table of REGISTRY_TABLES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM registry_staging.${table}`
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count === 0) {
      emptyTables.push(table);
    }
  }

  checks.push({
    name: "staging_core_tables_non_empty",
    passed: !emptyTables.includes("facilities") && !emptyTables.includes("professionals"),
    details: { emptyTables },
  });

  const facilityCountRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM registry_staging.facilities`
  );
  const stagingFacilityCount = Number(facilityCountRows[0]?.count ?? 0);

  const currentRegistryRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM registry.facilities`
  );
  const currentRegistryCount = Number(currentRegistryRows[0]?.count ?? 0);

  if (currentRegistryCount > 0 && stagingFacilityCount > 0) {
    const deltaPct =
      (Math.abs(stagingFacilityCount - currentRegistryCount) / currentRegistryCount) * 100;
    checks.push({
      name: "facility_count_tolerance",
      passed: deltaPct <= config.validationRowTolerancePct,
      details: {
        stagingFacilityCount,
        currentRegistryCount,
        deltaPct: Number(deltaPct.toFixed(2)),
        tolerancePct: config.validationRowTolerancePct,
      },
    });
  } else {
    checks.push({
      name: "facility_count_tolerance",
      passed: true,
      details: { skipped: true, reason: "registry_empty_or_staging_empty" },
    });
  }

  const duplicateRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM (
      SELECT facility_id FROM registry_staging.facilities
      GROUP BY facility_id HAVING COUNT(*) > 1
    ) d`
  );
  checks.push({
    name: "no_duplicate_facility_keys",
    passed: Number(duplicateRows[0]?.count ?? 0) === 0,
    details: { duplicateCount: Number(duplicateRows[0]?.count ?? 0) },
  });

  const orphanAssociationRows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count
     FROM registry_staging.facility_professionals fp
     WHERE NOT EXISTS (
       SELECT 1 FROM registry_staging.facilities f WHERE f.facility_id = fp.facility_id
     )
        OR NOT EXISTS (
       SELECT 1 FROM registry_staging.professionals p WHERE p.professional_id = fp.professional_id
     )`
  );
  checks.push({
    name: "facility_professional_fk_integrity",
    passed: Number(orphanAssociationRows[0]?.count ?? 0) === 0,
    details: { orphanCount: Number(orphanAssociationRows[0]?.count ?? 0) },
  });

  const report: ValidationReport = {
    passed: checks.every((check) => check.passed),
    checks,
  };

  await prisma.ingestionRun.update({
    where: { id: input.ingestionRunId },
    data: { validationReport: report as object },
  });

  if (!report.passed) {
    throw new Error(`Staging validation failed: ${JSON.stringify(report.checks.filter((c) => !c.passed))}`);
  }

  return report;
}

export async function promoteRegistrySwapActivity(input: {
  ingestionRunId: string;
}): Promise<{ promotedAt: string }> {
  await updateIngestionRunPhase(input.ingestionRunId, "PROMOTING");

  const { promoteRegistrySchemas } = await import("../infrastructure/registry-schemas");
  await promoteRegistrySchemas();

  const promotedAt = new Date();
  await prisma.ingestionRun.update({
    where: { id: input.ingestionRunId },
    data: { promotedAt },
  });

  return { promotedAt: promotedAt.toISOString() };
}
