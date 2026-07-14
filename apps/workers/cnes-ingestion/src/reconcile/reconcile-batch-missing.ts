import { sql } from "drizzle-orm";
import { db } from "../infrastructure/db";

export async function batchFacilityDeactivations(input: {
  ingestionRunId: string;
  now: Date;
}): Promise<number> {
  const stagingCountResult = await db.execute<{ count: bigint }>(
    sql`SELECT COUNT(*)::bigint AS count FROM registry_staging.facilities`
  );
  if (Number(stagingCountResult[0]?.count ?? 0) === 0) {
    return 0;
  }

  await db.execute(sql`
    UPDATE ingestion.cnes_suggestions s
    SET status = 'SUPERSEDED', resolved_at = ${input.now}
    FROM public.facilities f
    WHERE s.facility_id = f.id
      AND s.type = 'FACILITY_REGISTRY_DEACTIVATED'
      AND s.status = 'PENDING'
      AND f.source_provider = 'cnes'
      AND f.deactivated_at IS NULL
      AND f.source_present = TRUE
      AND f.external_source_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM registry_staging.facilities sf
        WHERE sf.facility_id = f.external_source_id
      )
  `);

  const rows = await db.execute<{ count: bigint }>(sql`
    WITH missing AS (
      SELECT f.id, f.external_source_id, f.name
      FROM public.facilities f
      WHERE f.source_provider = 'cnes'
        AND f.deactivated_at IS NULL
        AND f.external_source_id IS NOT NULL
        AND f.source_present = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM registry_staging.facilities sf
          WHERE sf.facility_id = f.external_source_id
        )
    ),
    updated AS (
      UPDATE public.facilities f
      SET source_present = FALSE, source_last_seen_at = ${input.now}
      FROM missing m
      WHERE f.id = m.id
      RETURNING f.id, f.external_source_id, f.name
    )
    INSERT INTO ingestion.cnes_suggestions (
      id, cnes_run_id, type, status, facility_id, reason, payload, suggested_at
    )
    SELECT
      gen_random_uuid()::text,
      ${input.ingestionRunId},
      'FACILITY_REGISTRY_DEACTIVATED',
      'PENDING',
      u.id,
      'missing_from_source',
      jsonb_build_object(
        'externalSourceId', u.external_source_id,
        'name', u.name
      ),
      ${input.now}
    FROM updated u
    RETURNING 1
  `);

  return rows.length;
}

export async function batchAssociationRemovals(input: {
  ingestionRunId: string;
  now: Date;
}): Promise<number> {
  const stagingCountResult = await db.execute<{ count: bigint }>(
    sql`SELECT COUNT(*)::bigint AS count FROM registry_staging.facility_professionals`
  );
  if (Number(stagingCountResult[0]?.count ?? 0) === 0) {
    return 0;
  }

  await db.execute(sql`
    UPDATE ingestion.cnes_suggestions s
    SET status = 'SUPERSEDED', resolved_at = ${input.now}
    FROM public.facility_professionals fp
    INNER JOIN public.facilities f ON f.id = fp.facility_id
    INNER JOIN public.professionals p ON p.id = fp.professional_id
    WHERE s.facility_professional_id = fp.id
      AND s.type = 'FACILITY_PROFESSIONAL_REMOVAL'
      AND s.status = 'PENDING'
      AND fp.ended_at IS NULL
      AND fp.source_active = TRUE
      AND f.source_provider = 'cnes'
      AND NOT EXISTS (
        SELECT 1
        FROM registry_staging.facility_professionals sa
        WHERE sa.facility_id = f.external_source_id
          AND sa.professional_id = p.external_source_id
      )
  `);

  const rows = await db.execute<{ count: bigint }>(sql`
    WITH missing AS (
      SELECT
        fp.id AS association_id,
        fp.facility_id,
        fp.professional_id,
        f.external_source_id AS facility_external_id,
        p.external_source_id AS professional_external_id
      FROM public.facility_professionals fp
      INNER JOIN public.facilities f ON f.id = fp.facility_id
      INNER JOIN public.professionals p ON p.id = fp.professional_id
      WHERE fp.ended_at IS NULL
        AND fp.source_active = TRUE
        AND f.source_provider = 'cnes'
        AND NOT EXISTS (
          SELECT 1
          FROM registry_staging.facility_professionals sa
          WHERE sa.facility_id = f.external_source_id
            AND sa.professional_id = p.external_source_id
        )
    ),
    updated AS (
      UPDATE public.facility_professionals fp
      SET source_active = FALSE
      FROM missing m
      WHERE fp.id = m.association_id
      RETURNING
        fp.id,
        m.facility_id,
        m.professional_id,
        m.facility_external_id,
        m.professional_external_id
    )
    INSERT INTO ingestion.cnes_suggestions (
      id, cnes_run_id, type, status, facility_id, professional_id,
      facility_professional_id, reason, payload, suggested_at
    )
    SELECT
      gen_random_uuid()::text,
      ${input.ingestionRunId},
      'FACILITY_PROFESSIONAL_REMOVAL',
      'PENDING',
      u.facility_id,
      u.professional_id,
      u.id,
      'missing_from_source',
      jsonb_build_object(
        'facilityExternalId', u.facility_external_id,
        'professionalExternalId', u.professional_external_id
      ),
      ${input.now}
    FROM updated u
    RETURNING 1
  `);

  return rows.length;
}

export async function batchRepresentativeRemovals(input: {
  ingestionRunId: string;
  now: Date;
}): Promise<number> {
  const stagingCountResult = await db.execute<{ count: bigint }>(
    sql`SELECT COUNT(*)::bigint AS count FROM registry_staging.facility_representatives`
  );
  if (Number(stagingCountResult[0]?.count ?? 0) === 0) {
    return 0;
  }

  await db.execute(sql`
    UPDATE ingestion.cnes_suggestions s
    SET status = 'SUPERSEDED', resolved_at = ${input.now}
    FROM public.facility_representatives fr
    INNER JOIN public.facilities f ON f.id = fr.facility_id
    WHERE s.facility_id = fr.facility_id
      AND s.type = 'FACILITY_REPRESENTATIVE_REMOVAL'
      AND s.status = 'PENDING'
      AND fr.ended_at IS NULL
      AND fr.source_active = TRUE
      AND fr.source_provider = 'cnes'
      AND NOT EXISTS (
        SELECT 1 FROM registry_staging.facility_representatives sr
        WHERE sr.facility_id = f.external_source_id
      )
  `);

  const rows = await db.execute<{ count: bigint }>(sql`
    WITH missing AS (
      SELECT
        fr.id AS representative_id,
        fr.facility_id,
        fr.external_source_key,
        fr.representative_name
      FROM public.facility_representatives fr
      INNER JOIN public.facilities f ON f.id = fr.facility_id
      WHERE fr.ended_at IS NULL
        AND fr.source_active = TRUE
        AND fr.source_provider = 'cnes'
        AND NOT EXISTS (
          SELECT 1 FROM registry_staging.facility_representatives sr
          WHERE sr.facility_id = f.external_source_id
        )
    ),
    updated AS (
      UPDATE public.facility_representatives fr
      SET source_active = FALSE
      FROM missing m
      WHERE fr.id = m.representative_id
      RETURNING
        fr.facility_id,
        fr.external_source_key,
        fr.representative_name
    )
    INSERT INTO ingestion.cnes_suggestions (
      id, cnes_run_id, type, status, facility_id, reason, payload, suggested_at
    )
    SELECT
      gen_random_uuid()::text,
      ${input.ingestionRunId},
      'FACILITY_REPRESENTATIVE_REMOVAL',
      'PENDING',
      u.facility_id,
      'missing_from_source',
      jsonb_build_object(
        'externalSourceKey', u.external_source_key,
        'representativeName', u.representative_name
      ),
      ${input.now}
    FROM updated u
    RETURNING 1
  `);

  return rows.length;
}
