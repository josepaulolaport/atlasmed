import { prisma } from "../infrastructure/prisma";

export async function batchFacilityDeactivations(input: {
  ingestionRunId: string;
  now: Date;
}): Promise<number> {
  const stagingCountRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM registry_staging.facilities
  `;
  if (Number(stagingCountRows[0]?.count ?? 0) === 0) {
    return 0;
  }

  await prisma.$executeRaw`
    UPDATE public.ingestion_suggestions s
    SET status = 'SUPERSEDED', "resolvedAt" = ${input.now}
    FROM public.facilities f
    WHERE s."facilityId" = f.id
      AND s.type = 'FACILITY_REGISTRY_DEACTIVATED'
      AND s.status = 'PENDING'
      AND f."sourceProvider" = 'cnes'
      AND f."deletedAt" IS NULL
      AND f."sourcePresent" = TRUE
      AND f."externalSourceId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM registry_staging.facilities sf
        WHERE sf.facility_id = f."externalSourceId"
      )
  `;

  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    WITH missing AS (
      SELECT f.id, f."externalSourceId", f.name
      FROM public.facilities f
      WHERE f."sourceProvider" = 'cnes'
        AND f."deletedAt" IS NULL
        AND f."externalSourceId" IS NOT NULL
        AND f."sourcePresent" = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM registry_staging.facilities sf
          WHERE sf.facility_id = f."externalSourceId"
        )
    ),
    updated AS (
      UPDATE public.facilities f
      SET "sourcePresent" = FALSE, "sourceLastSeenAt" = ${input.now}
      FROM missing m
      WHERE f.id = m.id
      RETURNING f.id, f."externalSourceId", f.name
    )
    INSERT INTO public.ingestion_suggestions (
      id, "ingestionRunId", type, status, "facilityId", reason, payload, "suggestedAt"
    )
    SELECT
      gen_random_uuid()::text,
      ${input.ingestionRunId},
      'FACILITY_REGISTRY_DEACTIVATED',
      'PENDING',
      u.id,
      'missing_from_source',
      jsonb_build_object(
        'externalSourceId', u."externalSourceId",
        'name', u.name
      ),
      ${input.now}
    FROM updated u
    RETURNING 1
  `;

  return rows.length;
}

export async function batchAssociationRemovals(input: {
  ingestionRunId: string;
  now: Date;
}): Promise<number> {
  const stagingCountRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM registry_staging.facility_professionals
  `;
  if (Number(stagingCountRows[0]?.count ?? 0) === 0) {
    return 0;
  }

  await prisma.$executeRaw`
    UPDATE public.ingestion_suggestions s
    SET status = 'SUPERSEDED', "resolvedAt" = ${input.now}
    FROM public.facility_professionals fp
    INNER JOIN public.facilities f ON f.id = fp."facilityId"
    INNER JOIN public.professionals p ON p.id = fp."professionalId"
    WHERE s."facilityProfessionalId" = fp.id
      AND s.type = 'FACILITY_PROFESSIONAL_REMOVAL'
      AND s.status = 'PENDING'
      AND fp."endedAt" IS NULL
      AND fp."sourceActive" = TRUE
      AND f."sourceProvider" = 'cnes'
      AND NOT EXISTS (
        SELECT 1
        FROM registry_staging.facility_professionals sa
        WHERE sa.facility_id = f."externalSourceId"
          AND sa.professional_id = p."externalSourceId"
      )
  `;

  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    WITH missing AS (
      SELECT
        fp.id AS association_id,
        fp."facilityId",
        fp."professionalId",
        f."externalSourceId" AS facility_external_id,
        p."externalSourceId" AS professional_external_id
      FROM public.facility_professionals fp
      INNER JOIN public.facilities f ON f.id = fp."facilityId"
      INNER JOIN public.professionals p ON p.id = fp."professionalId"
      WHERE fp."endedAt" IS NULL
        AND fp."sourceActive" = TRUE
        AND f."sourceProvider" = 'cnes'
        AND NOT EXISTS (
          SELECT 1
          FROM registry_staging.facility_professionals sa
          WHERE sa.facility_id = f."externalSourceId"
            AND sa.professional_id = p."externalSourceId"
        )
    ),
    updated AS (
      UPDATE public.facility_professionals fp
      SET "sourceActive" = FALSE
      FROM missing m
      WHERE fp.id = m.association_id
      RETURNING
        fp.id,
        m."facilityId",
        m."professionalId",
        m.facility_external_id,
        m.professional_external_id
    )
    INSERT INTO public.ingestion_suggestions (
      id, "ingestionRunId", type, status, "facilityId", "professionalId",
      "facilityProfessionalId", reason, payload, "suggestedAt"
    )
    SELECT
      gen_random_uuid()::text,
      ${input.ingestionRunId},
      'FACILITY_PROFESSIONAL_REMOVAL',
      'PENDING',
      u."facilityId",
      u."professionalId",
      u.id,
      'missing_from_source',
      jsonb_build_object(
        'facilityExternalId', u.facility_external_id,
        'professionalExternalId', u.professional_external_id
      ),
      ${input.now}
    FROM updated u
    RETURNING 1
  `;

  return rows.length;
}

export async function batchRepresentativeRemovals(input: {
  ingestionRunId: string;
  now: Date;
}): Promise<number> {
  const stagingCountRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM registry_staging.facility_representatives
  `;
  if (Number(stagingCountRows[0]?.count ?? 0) === 0) {
    return 0;
  }

  await prisma.$executeRaw`
    UPDATE public.ingestion_suggestions s
    SET status = 'SUPERSEDED', "resolvedAt" = ${input.now}
    FROM public.facility_representatives fr
    INNER JOIN public.facilities f ON f.id = fr."facilityId"
    WHERE s."facilityId" = fr."facilityId"
      AND s.type = 'FACILITY_REPRESENTATIVE_REMOVAL'
      AND s.status = 'PENDING'
      AND fr.ended_at IS NULL
      AND fr.source_active = TRUE
      AND fr.source_provider = 'cnes'
      AND NOT EXISTS (
        SELECT 1 FROM registry_staging.facility_representatives sr
        WHERE sr.facility_id = f."externalSourceId"
      )
  `;

  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    WITH missing AS (
      SELECT
        fr.id AS representative_id,
        fr."facilityId",
        fr.external_source_key,
        fr.representative_name
      FROM public.facility_representatives fr
      INNER JOIN public.facilities f ON f.id = fr."facilityId"
      WHERE fr.ended_at IS NULL
        AND fr.source_active = TRUE
        AND fr.source_provider = 'cnes'
        AND NOT EXISTS (
          SELECT 1 FROM registry_staging.facility_representatives sr
          WHERE sr.facility_id = f."externalSourceId"
        )
    ),
    updated AS (
      UPDATE public.facility_representatives fr
      SET source_active = FALSE
      FROM missing m
      WHERE fr.id = m.representative_id
      RETURNING
        fr."facilityId",
        fr.external_source_key,
        fr.representative_name
    )
    INSERT INTO public.ingestion_suggestions (
      id, "ingestionRunId", type, status, "facilityId", reason, payload, "suggestedAt"
    )
    SELECT
      gen_random_uuid()::text,
      ${input.ingestionRunId},
      'FACILITY_REPRESENTATIVE_REMOVAL',
      'PENDING',
      u."facilityId",
      'missing_from_source',
      jsonb_build_object(
        'externalSourceKey', u.external_source_key,
        'representativeName', u.representative_name
      ),
      ${input.now}
    FROM updated u
    RETURNING 1
  `;

  return rows.length;
}
