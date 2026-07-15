import {
  cnesRuns,
  cnesSuggestions,
  facilities,
  facilityProfessionals,
  professionals
} from '@atlasmed/database'
import { eq, inArray, or } from 'drizzle-orm'
import { db } from '../../../../infrastructure/database/db'
import { MOCK_REGISTRY_PROVIDER } from '../../application/interfaces/registry-source.port'

export async function cleanupMockRegistryData(): Promise<void> {
  const mockClinics = await db
    .select({ id: facilities.id })
    .from(facilities)
    .where(eq(facilities.sourceProvider, MOCK_REGISTRY_PROVIDER))

  const mockDoctors = await db
    .select({ id: professionals.id })
    .from(professionals)
    .where(eq(professionals.sourceProvider, MOCK_REGISTRY_PROVIDER))

  const facilityIds = mockClinics.map((c) => c.id)
  const professionalIds = mockDoctors.map((d) => d.id)

  if (facilityIds.length > 0 || professionalIds.length > 0) {
    const suggestionConditions = [
      ...(facilityIds.length > 0 ? [inArray(cnesSuggestions.facilityId, facilityIds)] : []),
      ...(professionalIds.length > 0
        ? [inArray(cnesSuggestions.professionalId, professionalIds)]
        : [])
    ]
    await db.delete(cnesSuggestions).where(or(...suggestionConditions))

    const fpConditions = [
      ...(facilityIds.length > 0 ? [inArray(facilityProfessionals.facilityId, facilityIds)] : []),
      ...(professionalIds.length > 0
        ? [inArray(facilityProfessionals.professionalId, professionalIds)]
        : [])
    ]
    await db.delete(facilityProfessionals).where(or(...fpConditions))
  }

  await db.delete(cnesRuns).where(eq(cnesRuns.sourceProvider, MOCK_REGISTRY_PROVIDER))
  await db.delete(professionals).where(eq(professionals.sourceProvider, MOCK_REGISTRY_PROVIDER))
  await db.delete(facilities).where(eq(facilities.sourceProvider, MOCK_REGISTRY_PROVIDER))
}
