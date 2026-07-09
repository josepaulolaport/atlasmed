import { REGISTRY_TABLES } from "@atlasmed/cnes-ingestion";
import { prisma } from "../infrastructure/prisma";
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
  return reconcileCrmFromStaging(input);
}

export async function reconcileWarehouseDiffActivity(_input: {
  ingestionRunId: string;
}): Promise<Record<string, unknown>> {
  const tableStats: Record<string, { staging: number; current: number }> = {};

  for (const table of REGISTRY_TABLES) {
    const [stagingRows, currentRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count FROM registry_staging.${table}`
      ),
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count FROM registry.${table}`
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

  const facilitiesUpdated = await prisma.$executeRaw`
    UPDATE public.facilities f
    SET
      "sourceLastSeenAt" = ${now},
      "sourcePresent" = TRUE,
      "updatedAt" = NOW()
    FROM registry.facilities r
    WHERE f."sourceProvider" = 'cnes'
      AND f."externalSourceId" = r.facility_id
  `;

  const professionalsUpdated = await prisma.$executeRaw`
    UPDATE public.professionals p
    SET
      "sourceLastSeenAt" = ${now},
      "sourcePresent" = TRUE,
      "updatedAt" = NOW()
    FROM registry.professionals r
    WHERE p."sourceProvider" = 'cnes'
      AND p."externalSourceId" = r.professional_id
  `;

  const facilitiesMarkedAbsent = await prisma.$executeRaw`
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
  `;

  const professionalsMarkedAbsent = await prisma.$executeRaw`
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
  `;

  const facilityHashRows = await prisma.$queryRawUnsafe<
    Array<{
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
    }>
  >(
    `SELECT
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
     WHERE f."sourceProvider" = 'cnes'`
  );

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

    await prisma.facility.update({
      where: { id: row.id },
      data: { sourceContentHash: hash },
    });
  }

  const professionalHashRows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      full_name: string;
      tax_id: string | null;
    }>
  >(
    `SELECT p.id, r.full_name, r.tax_id
     FROM public.professionals p
     INNER JOIN registry.professionals r ON r.professional_id = p."externalSourceId"
     WHERE p."sourceProvider" = 'cnes'`
  );

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

    await prisma.professional.update({
      where: { id: row.id },
      data: { sourceContentHash: hash },
    });
  }

  return {
    facilitiesUpdated: Number(facilitiesUpdated),
    professionalsUpdated: Number(professionalsUpdated),
    facilitiesMarkedAbsent: Number(facilitiesMarkedAbsent),
    professionalsMarkedAbsent: Number(professionalsMarkedAbsent),
  };
}

export async function finalizeIngestionRunActivity(input: {
  ingestionRunId: string;
  stats: Record<string, unknown>;
}): Promise<void> {
  await prisma.ingestionRun.update({
    where: { id: input.ingestionRunId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      stats: input.stats as object,
    },
  });
}
