import { CNES_REGISTRY_PROVIDER } from '@atlasmed/cnes-ingestion'
import {
  cnesDiffs,
  cnesSuggestions,
  facilities,
  facilityProfessionals,
  facilityRepresentatives,
  professionals
} from '@atlasmed/database'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../infrastructure/db'
import { computeContentHash } from './content-hash'
import {
  batchAssociationRemovals,
  batchFacilityDeactivations,
  batchRepresentativeRemovals
} from './reconcile-batch-missing'

interface ReconcileStats {
  facilitiesCreated: number
  facilityFieldUpdates: number
  facilityDeactivations: number
  facilityReactivations: number
  professionalsCreated: number
  professionalFieldUpdates: number
  associationsCreated: number
  associationAddsSuggested: number
  associationRemovals: number
  representativesCreated: number
  representativeFieldUpdates: number
  representativeRemovals: number
}

function facilityDisplayName(legalName: string | null, tradeName: string | null): string {
  return (tradeName?.trim() || legalName?.trim() || 'Unknown facility').trim()
}

export async function reconcileCrmFromStaging(input: {
  ingestionRunId: string
}): Promise<ReconcileStats> {
  const stats: ReconcileStats = {
    facilitiesCreated: 0,
    facilityFieldUpdates: 0,
    facilityDeactivations: 0,
    facilityReactivations: 0,
    professionalsCreated: 0,
    professionalFieldUpdates: 0,
    associationsCreated: 0,
    associationAddsSuggested: 0,
    associationRemovals: 0,
    representativesCreated: 0,
    representativeFieldUpdates: 0,
    representativeRemovals: 0
  }

  const now = new Date()

  const stagingFacilities = await db.execute<{
    facility_id: string
    legal_name: string | null
    trade_name: string | null
    street_address: string | null
    street_number: string | null
    neighborhood: string | null
    postal_code: string | null
    latitude: number | null
    longitude: number | null
    municipality_id: string | null
  }>(sql`SELECT facility_id, legal_name, trade_name, street_address, street_number, neighborhood, postal_code, latitude, longitude, municipality_id
     FROM registry_staging.facilities`)

  const facilityExternalToInternal = new Map<string, string>()

  for (const row of stagingFacilities) {
    const name = facilityDisplayName(row.legal_name, row.trade_name)
    const hashPayload = {
      name,
      streetAddress: row.street_address,
      streetNumber: row.street_number,
      neighborhood: row.neighborhood,
      postalCode: row.postal_code,
      lat: row.latitude,
      lng: row.longitude
    }
    const contentHash = computeContentHash(hashPayload)

    const [existing] = await db
      .select()
      .from(facilities)
      .where(
        and(
          eq(facilities.sourceProvider, CNES_REGISTRY_PROVIDER),
          eq(facilities.externalSourceId, row.facility_id)
        )
      )
      .limit(1)

    if (!existing) {
      const [created] = await db
        .insert(facilities)
        .values({
          displayName: name,
          streetAddress: row.street_address,
          streetNumber: row.street_number,
          neighborhood: row.neighborhood,
          postalCode: row.postal_code,
          sourceProvider: CNES_REGISTRY_PROVIDER,
          externalSourceId: row.facility_id,
          sourceContentHash: contentHash,
          sourceFirstSeenAt: now,
          sourceLastSeenAt: now,
          sourcePresent: true,
          sourceTracked: true
        })
        .returning()
      if (!created) {
        throw new Error('Failed to create facility during reconciliation')
      }
      facilityExternalToInternal.set(row.facility_id, created.id)
      stats.facilitiesCreated += 1
      continue
    }

    facilityExternalToInternal.set(row.facility_id, existing.id)

    if (existing.deactivatedAt) {
      await createSuggestion({
        ingestionRunId: input.ingestionRunId,
        type: 'FACILITY_REGISTRY_REACTIVATED',
        facilityId: existing.id,
        reason: 'reappeared_in_source',
        payload: { externalSourceId: row.facility_id, name }
      })
      stats.facilityReactivations += 1
    }

    if (existing.sourceContentHash !== contentHash) {
      const changes = []
      if (existing.displayName !== name) {
        changes.push({ field: 'displayName', current: existing.displayName, proposed: name })
      }
      if (existing.streetAddress !== row.street_address) {
        changes.push({
          field: 'streetAddress',
          current: existing.streetAddress,
          proposed: row.street_address
        })
      }

      if (changes.length > 0) {
        await supersedePending({
          type: 'FACILITY_FIELD_UPDATE',
          facilityId: existing.id
        })
        await createSuggestion({
          ingestionRunId: input.ingestionRunId,
          type: 'FACILITY_FIELD_UPDATE',
          facilityId: existing.id,
          reason: 'registry_field_mismatch',
          payload: { changes }
        })
        stats.facilityFieldUpdates += 1
      }
    }
  }

  stats.facilityDeactivations = await batchFacilityDeactivations({
    ingestionRunId: input.ingestionRunId,
    now
  })

  const stagingProfessionals = await db.execute<{
    professional_id: string
    full_name: string | null
    social_name: string | null
    tax_id: string | null
  }>(sql`SELECT professional_id, full_name, social_name, tax_id
     FROM registry_staging.professionals`)

  const professionalExternalToInternal = new Map<string, string>()

  for (const row of stagingProfessionals) {
    const fullName = row.full_name?.trim() || 'Unknown'
    const nameParts = fullName.split(/\s+/)
    const firstName = nameParts[0] ?? fullName
    const lastName = nameParts.slice(1).join(' ') || firstName
    const hashPayload = {
      firstName,
      lastName,
      fullName,
      specialty: null,
      taxId: row.tax_id,
      email: null,
      mobilePhone: null
    }
    const contentHash = computeContentHash(hashPayload)

    const [existing] = await db
      .select()
      .from(professionals)
      .where(
        and(
          eq(professionals.sourceProvider, CNES_REGISTRY_PROVIDER),
          eq(professionals.externalSourceId, row.professional_id)
        )
      )
      .limit(1)

    if (!existing) {
      const [created] = await db
        .insert(professionals)
        .values({
          firstName,
          lastName,
          fullName,
          socialName: row.social_name,
          taxId: row.tax_id,
          sourceProvider: CNES_REGISTRY_PROVIDER,
          externalSourceId: row.professional_id,
          sourceContentHash: contentHash,
          sourceFirstSeenAt: now,
          sourceLastSeenAt: now,
          sourcePresent: true,
          sourceTracked: true
        })
        .returning()
      if (!created) {
        throw new Error('Failed to create professional during reconciliation')
      }
      professionalExternalToInternal.set(row.professional_id, created.id)
      stats.professionalsCreated += 1
      continue
    }

    professionalExternalToInternal.set(row.professional_id, existing.id)

    if (existing.sourceContentHash !== contentHash) {
      const changes = []
      if (existing.firstName !== firstName) {
        changes.push({ field: 'firstName', current: existing.firstName, proposed: firstName })
      }
      if (existing.lastName !== lastName) {
        changes.push({ field: 'lastName', current: existing.lastName, proposed: lastName })
      }

      if (changes.length > 0) {
        await supersedePending({
          type: 'PROFESSIONAL_FIELD_UPDATE',
          professionalId: existing.id
        })
        await createSuggestion({
          ingestionRunId: input.ingestionRunId,
          type: 'PROFESSIONAL_FIELD_UPDATE',
          professionalId: existing.id,
          reason: 'registry_field_mismatch',
          payload: { changes }
        })
        stats.professionalFieldUpdates += 1
      }
    }
  }

  const stagingAssociations = await db.execute<{
    facility_id: string
    professional_id: string
  }>(sql`SELECT facility_id, professional_id FROM registry_staging.facility_professionals`)

  const associationFacilityIds = [...new Set(stagingAssociations.map((row) => row.facility_id))]
  const associationProfessionalIds = [
    ...new Set(stagingAssociations.map((row) => row.professional_id))
  ]

  const preExistingFacilityIds = new Set<string>()
  if (associationFacilityIds.length > 0) {
    const rows = await db.execute<{ externalSourceId: string }>(sql`
      SELECT "externalSourceId"
       FROM public.facilities
       WHERE "sourceProvider" = ${CNES_REGISTRY_PROVIDER}
         AND "externalSourceId" = ANY(${associationFacilityIds}::text[])`)
    for (const row of rows) {
      if (row.externalSourceId) {
        preExistingFacilityIds.add(row.externalSourceId)
      }
    }
  }

  const preExistingProfessionalIds = new Set<string>()
  if (associationProfessionalIds.length > 0) {
    const rows = await db.execute<{ externalSourceId: string }>(sql`
      SELECT "externalSourceId"
       FROM public.professionals
       WHERE "sourceProvider" = ${CNES_REGISTRY_PROVIDER}
         AND "externalSourceId" = ANY(${associationProfessionalIds}::text[])`)
    for (const row of rows) {
      if (row.externalSourceId) {
        preExistingProfessionalIds.add(row.externalSourceId)
      }
    }
  }

  for (const row of stagingAssociations) {
    const facilityId = facilityExternalToInternal.get(row.facility_id)
    const professionalId = professionalExternalToInternal.get(row.professional_id)
    if (!facilityId || !professionalId) {
      continue
    }

    const [existing] = await db
      .select()
      .from(facilityProfessionals)
      .where(
        and(
          eq(facilityProfessionals.facilityId, facilityId),
          eq(facilityProfessionals.professionalId, professionalId),
          isNull(facilityProfessionals.endedAt)
        )
      )
      .limit(1)

    if (existing) {
      continue
    }

    const facilityExisted = preExistingFacilityIds.has(row.facility_id)
    const professionalExisted = preExistingProfessionalIds.has(row.professional_id)

    if (facilityExisted || professionalExisted) {
      await createSuggestion({
        ingestionRunId: input.ingestionRunId,
        type: 'FACILITY_PROFESSIONAL_ADD',
        facilityId,
        professionalId,
        reason: 'new_association_with_existing_entity',
        payload: {
          facilityExternalId: row.facility_id,
          professionalExternalId: row.professional_id
        }
      })
      stats.associationAddsSuggested += 1
      continue
    }

    await db.insert(facilityProfessionals).values({
      facilityId,
      professionalId,
      sourceActive: true,
      sourceFirstSeenAt: now,
      sourceLastSeenAt: now
    })
    stats.associationsCreated += 1
  }

  stats.associationRemovals = await batchAssociationRemovals({
    ingestionRunId: input.ingestionRunId,
    now
  })

  const stagingRepresentatives = await db.execute<{
    facility_id: string
    representative_name: string
    role_title: string | null
    email: string | null
    tax_id: string | null
  }>(sql`SELECT facility_id, representative_name, role_title, email, tax_id
     FROM registry_staging.facility_representatives`)

  const preExistingFacilityIdsForReps = new Set<string>()
  const representativeFacilityIds = [
    ...new Set(stagingRepresentatives.map((row) => row.facility_id))
  ]
  if (representativeFacilityIds.length > 0) {
    const rows = await db.execute<{ externalSourceId: string }>(sql`
      SELECT "externalSourceId"
       FROM public.facilities
       WHERE "sourceProvider" = ${CNES_REGISTRY_PROVIDER}
         AND "externalSourceId" = ANY(${representativeFacilityIds}::text[])`)
    for (const row of rows) {
      if (row.externalSourceId) {
        preExistingFacilityIdsForReps.add(row.externalSourceId)
      }
    }
  }

  for (const row of stagingRepresentatives) {
    const facilityId = facilityExternalToInternal.get(row.facility_id)
    if (!facilityId) {
      continue
    }

    const externalSourceKey = `cnes:${row.facility_id}`
    const taxId = row.tax_id?.trim() || row.representative_name
    const hashPayload = {
      representativeName: row.representative_name,
      roleTitle: row.role_title,
      email: row.email,
      taxId
    }
    const _contentHash = computeContentHash(hashPayload)

    const [existing] = await db
      .select()
      .from(facilityRepresentatives)
      .where(
        and(
          eq(facilityRepresentatives.facilityId, facilityId),
          eq(facilityRepresentatives.externalSourceKey, externalSourceKey),
          isNull(facilityRepresentatives.endedAt)
        )
      )
      .limit(1)

    if (!existing) {
      if (preExistingFacilityIdsForReps.has(row.facility_id)) {
        await createSuggestion({
          ingestionRunId: input.ingestionRunId,
          type: 'FACILITY_REPRESENTATIVE_ADD',
          facilityId,
          reason: 'new_representative_with_existing_facility',
          payload: {
            externalSourceKey,
            representativeName: row.representative_name,
            roleTitle: row.role_title,
            email: row.email,
            taxId
          }
        })
        stats.representativesCreated += 1
        continue
      }

      await db.insert(facilityRepresentatives).values({
        facilityId,
        externalSourceKey,
        representativeName: row.representative_name,
        roleTitle: row.role_title,
        email: row.email,
        taxId,
        sourceProvider: CNES_REGISTRY_PROVIDER,
        sourceActive: true
      })
      stats.representativesCreated += 1
      continue
    }

    const changes = []
    if (existing.representativeName !== row.representative_name) {
      changes.push({
        field: 'representativeName',
        current: existing.representativeName,
        proposed: row.representative_name
      })
    }
    if (existing.email !== row.email) {
      changes.push({ field: 'email', current: existing.email, proposed: row.email })
    }

    if (changes.length > 0) {
      await supersedePending({
        type: 'FACILITY_REPRESENTATIVE_FIELD_UPDATE',
        facilityId
      })
      await createSuggestion({
        ingestionRunId: input.ingestionRunId,
        type: 'FACILITY_REPRESENTATIVE_FIELD_UPDATE',
        facilityId,
        reason: 'registry_field_mismatch',
        payload: {
          externalSourceKey,
          representativeName: row.representative_name,
          roleTitle: row.role_title,
          email: row.email,
          taxId,
          changes
        },
        entityType: 'representative',
        externalSourceId: externalSourceKey,
        diffType: 'CHANGED'
      })
      stats.representativeFieldUpdates += 1
    }
  }

  stats.representativeRemovals = await batchRepresentativeRemovals({
    ingestionRunId: input.ingestionRunId,
    now
  })

  return stats
}

async function recordDiff(input: {
  ingestionRunId: string
  entityType: string
  externalSourceId?: string
  diffType: string
  payload?: Record<string, unknown>
}): Promise<void> {
  await db.insert(cnesDiffs).values({
    cnesRunId: input.ingestionRunId,
    scope: 'CRM',
    entityType: input.entityType,
    externalSourceId: input.externalSourceId,
    diffType: input.diffType,
    payload: (input.payload ?? {}) as object
  })
}

const SUGGESTION_DIFF_DEFAULTS: Record<string, { entityType: string; diffType: string }> = {
  FACILITY_FIELD_UPDATE: { entityType: 'facility', diffType: 'CHANGED' },
  FACILITY_REGISTRY_DEACTIVATED: { entityType: 'facility', diffType: 'REMOVED' },
  FACILITY_REGISTRY_REACTIVATED: { entityType: 'facility', diffType: 'REACTIVATED' },
  PROFESSIONAL_FIELD_UPDATE: { entityType: 'professional', diffType: 'CHANGED' },
  FACILITY_PROFESSIONAL_ADD: { entityType: 'association', diffType: 'ADDED' },
  FACILITY_PROFESSIONAL_REMOVAL: { entityType: 'association', diffType: 'REMOVED' },
  FACILITY_REPRESENTATIVE_ADD: { entityType: 'representative', diffType: 'ADDED' },
  FACILITY_REPRESENTATIVE_FIELD_UPDATE: { entityType: 'representative', diffType: 'CHANGED' },
  FACILITY_REPRESENTATIVE_REMOVAL: { entityType: 'representative', diffType: 'REMOVED' }
}

function externalSourceIdFromPayload(
  type: string,
  payload?: Record<string, unknown>
): string | undefined {
  if (!payload) {
    return undefined
  }

  if (typeof payload.externalSourceId === 'string') {
    return payload.externalSourceId
  }
  if (typeof payload.externalSourceKey === 'string') {
    return payload.externalSourceKey
  }
  if (type === 'FACILITY_PROFESSIONAL_ADD' || type === 'FACILITY_PROFESSIONAL_REMOVAL') {
    const facilityExternalId =
      typeof payload.facilityExternalId === 'string' ? payload.facilityExternalId : ''
    const professionalExternalId =
      typeof payload.professionalExternalId === 'string' ? payload.professionalExternalId : ''
    return `${professionalExternalId}:${facilityExternalId}` || undefined
  }

  return undefined
}

async function createSuggestion(input: {
  ingestionRunId: string
  type: string
  facilityId?: string
  professionalId?: string
  facilityProfessionalId?: string
  reason?: string
  payload?: Record<string, unknown>
  entityType?: string
  externalSourceId?: string
  diffType?: string
}): Promise<void> {
  const [duplicate] = await db
    .select()
    .from(cnesSuggestions)
    .where(
      and(
        eq(cnesSuggestions.cnesRunId, input.ingestionRunId),
        eq(cnesSuggestions.type, input.type as never),
        eq(cnesSuggestions.status, 'PENDING'),
        input.facilityId
          ? eq(cnesSuggestions.facilityId, input.facilityId)
          : isNull(cnesSuggestions.facilityId),
        input.professionalId
          ? eq(cnesSuggestions.professionalId, input.professionalId)
          : isNull(cnesSuggestions.professionalId),
        input.facilityProfessionalId
          ? eq(cnesSuggestions.facilityProfessionalId, input.facilityProfessionalId)
          : isNull(cnesSuggestions.facilityProfessionalId)
      )
    )
    .limit(1)

  if (duplicate) {
    return
  }

  await db.insert(cnesSuggestions).values({
    cnesRunId: input.ingestionRunId,
    type: input.type as never,
    facilityId: input.facilityId,
    professionalId: input.professionalId,
    facilityProfessionalId: input.facilityProfessionalId,
    reason: input.reason,
    payload: (input.payload ?? {}) as object
  })

  if (input.entityType && input.diffType) {
    await recordDiff({
      ingestionRunId: input.ingestionRunId,
      entityType: input.entityType,
      externalSourceId: input.externalSourceId,
      diffType: input.diffType,
      payload: input.payload
    })
    return
  }

  const defaults = SUGGESTION_DIFF_DEFAULTS[input.type]
  if (defaults) {
    await recordDiff({
      ingestionRunId: input.ingestionRunId,
      entityType: defaults.entityType,
      externalSourceId: externalSourceIdFromPayload(input.type, input.payload),
      diffType: defaults.diffType,
      payload: input.payload
    })
  }
}

async function supersedePending(input: {
  type: string
  facilityId?: string
  professionalId?: string
  facilityProfessionalId?: string
}): Promise<void> {
  await db
    .update(cnesSuggestions)
    .set({
      status: 'SUPERSEDED',
      resolvedAt: new Date()
    })
    .where(
      and(
        eq(cnesSuggestions.type, input.type as never),
        eq(cnesSuggestions.status, 'PENDING'),
        input.facilityId
          ? eq(cnesSuggestions.facilityId, input.facilityId)
          : isNull(cnesSuggestions.facilityId),
        input.professionalId
          ? eq(cnesSuggestions.professionalId, input.professionalId)
          : isNull(cnesSuggestions.professionalId),
        input.facilityProfessionalId
          ? eq(cnesSuggestions.facilityProfessionalId, input.facilityProfessionalId)
          : isNull(cnesSuggestions.facilityProfessionalId)
      )
    )
}
