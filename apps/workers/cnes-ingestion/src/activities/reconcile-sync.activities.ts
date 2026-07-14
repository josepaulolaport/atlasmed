import { REGISTRY_TABLES } from "@atlasmed/cnes-ingestion";
import { facilities, professionals, cnesRuns } from "@atlasmed/database";
import { eq, sql } from "drizzle-orm";
import { db } from "../infrastructure/db";
import { updateIngestionRunPhase } from "./discover-download.activities";
import { reconcileCrmFromStaging } from "../reconcile/reconcile-crm.service";
import {
  buildFacilityAddress,
  computeContentHash,
} from "../reconcile/content-hash";

export async function reconcileCrmDiffActivity(input: {
  ingestionRunId: string;
}): Promise<Record<string, unknown>> {
  await updateIngestionRunPhase(input.ingestionRunId, "RECONCILING");
  const stats = await reconcileCrmFromStaging(input);
  return stats as unknown as Record<string, unknown>;
}

export async function reconcileWarehouseDiffActivity(_input: {
  ingestionRunId: string;
}): Promise<Record<string, unknown>> {
  const tableStats: Record<string, { staging: number; current: number }> = {};

  for (const table of REGISTRY_TABLES) {
    const [stagingRows, currentRows] = await Promise.all([
      db.execute<{ count: bigint }>(
        sql.raw(`SELECT COUNT(*)::bigint AS count FROM registry_staging.${table}`)
      ),
      db.execute<{ count: bigint }>(
        sql.raw(`SELECT COUNT(*)::bigint AS count FROM registry.${table}`)
      ),
    ]);

    tableStats[table] = {
      staging: Number(stagingRows[0]?.count ?? 0),
      current: Number(currentRows[0]?.count ?? 0),
    };
  }

  return { warehouseDiff: tableStats };
}

export async function syncCrmMetadataActivity(input: {
  ingestionRunId: string;
}): Promise<{
  facilitiesUpdated: number;
  professionalsUpdated: number;
  facilitiesMarkedAbsent: number;
  professionalsMarkedAbsent: number;
}> {
  await updateIngestionRunPhase(input.ingestionRunId, "SYNCING");

  const now = new Date();

  const facilitiesUpdatedResult = await db.execute(sql`
    UPDATE public.facilities f
    SET
      "sourceLastSeenAt" = ${now},
      "sourcePresent" = TRUE,
      "updatedAt" = NOW()
    FROM registry.facilities r
    WHERE f."sourceProvider" = 'cnes'
      AND f."externalSourceId" = r.facility_id
  `);

  const professionalsUpdatedResult = await db.execute(sql`
    UPDATE public.professionals p
    SET
      "sourceLastSeenAt" = ${now},
      "sourcePresent" = TRUE,
      "updatedAt" = NOW()
    FROM registry.professionals r
    WHERE p."sourceProvider" = 'cnes'
      AND p."externalSourceId" = r.professional_id
  `);

  const facilitiesMarkedAbsentResult = await db.execute(sql`
    UPDATE public.facilities f
    SET
      "sourcePresent" = FALSE,
      "updatedAt" = NOW()
    WHERE f."sourceProvider" = 'cnes'
      AND f."deletedAt" IS NULL
      AND f."externalSourceId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM registry.facilities r WHERE r.facility_id = f."externalSourceId"
      )
  `);

  const professionalsMarkedAbsentResult = await db.execute(sql`
    UPDATE public.professionals p
    SET
      "sourcePresent" = FALSE,
      "updatedAt" = NOW()
    WHERE p."sourceProvider" = 'cnes'
      AND p."deletedAt" IS NULL
      AND p."externalSourceId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM registry.professionals r WHERE r.professional_id = p."externalSourceId"
      )
  `);

  const facilityHashRows = await db.execute<{
    id: string;
    legal_name: string | null;
    trade_name: string | null;
    street_address: string | null;
    street_number: string | null;
    neighborhood: string | null;
    postal_code: string | null;
    latitude: number | null;
    longitude: number | null;
    municipality_id: string | null;
  }>(sql`
    SELECT
      f.id,
      r.legal_name,
      r.trade_name,
      r.street_address,
      r.street_number,
      r.neighborhood,
      r.postal_code,
      r.latitude,
      r.longitude,
      r.municipality_id
     FROM public.facilities f
     INNER JOIN registry.facilities r ON r.facility_id = f."externalSourceId"
     WHERE f."sourceProvider" = 'cnes'
  `);

  for (const row of facilityHashRows) {
    const name = (row.trade_name?.trim() || row.legal_name?.trim() || "Unknown facility").trim();
    const hash = computeContentHash({
      name,
      address: buildFacilityAddress({
        streetAddress: row.street_address,
        streetNumber: row.street_number,
        neighborhood: row.neighborhood,
        postalCode: row.postal_code,
      }),
      lat: row.latitude,
      lng: row.longitude,
      referenceMunicipalityCode: row.municipality_id,
    });

    await db
      .update(facilities)
      .set({ sourceContentHash: hash, updatedAt: new Date() })
      .where(eq(facilities.id, row.id));
  }

  const professionalHashRows = await db.execute<{
    id: string;
    full_name: string;
    tax_id: string | null;
  }>(sql`
    SELECT p.id, r.full_name, r.tax_id
     FROM public.professionals p
     INNER JOIN registry.professionals r ON r.professional_id = p."externalSourceId"
     WHERE p."sourceProvider" = 'cnes'
  `);

  for (const row of professionalHashRows) {
    const fullName = row.full_name.trim() || "Unknown";
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] ?? fullName;
    const lastName = nameParts.slice(1).join(" ") || firstName;
    const hash = computeContentHash({
      firstName,
      lastName,
      fullName,
      specialty: null,
      taxId: row.tax_id,
      email: null,
      mobilePhone: null,
    });

    await db
      .update(professionals)
      .set({ sourceContentHash: hash, updatedAt: new Date() })
      .where(eq(professionals.id, row.id));
  }

  return {
    facilitiesUpdated: Number(facilitiesUpdatedResult.count ?? 0),
    professionalsUpdated: Number(professionalsUpdatedResult.count ?? 0),
    facilitiesMarkedAbsent: Number(facilitiesMarkedAbsentResult.count ?? 0),
    professionalsMarkedAbsent: Number(professionalsMarkedAbsentResult.count ?? 0),
  };
}

export async function finalizeIngestionRunActivity(input: {
  ingestionRunId: string;
  stats: Record<string, unknown>;
}): Promise<void> {
  await db
    .update(cnesRuns)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      stats: input.stats as object,
    })
    .where(eq(cnesRuns.id, input.ingestionRunId));
}
