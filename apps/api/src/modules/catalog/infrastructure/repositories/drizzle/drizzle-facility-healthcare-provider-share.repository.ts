import { facilityHealthcareProviderShares, healthcareProviders } from '@atlasmed/database'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../../../../infrastructure/database/db'
import type {
  FacilityHealthcareProviderShareRecord,
  FacilityHealthcareProviderShareRepository
} from '../../../application/interfaces/facility-healthcare-provider-share.repository.interface'

function mapShare(row: {
  id: string
  facilityId: string
  healthcareProviderId: string
  sharePercent: string
  source: 'MANUAL' | 'REGISTRY' | 'IMPORT'
  createdAt: Date
  updatedAt: Date
  healthcareProvider: { id: string; name: string; type: string }
}): FacilityHealthcareProviderShareRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    healthcareProviderId: row.healthcareProviderId,
    sharePercent: Number(row.sharePercent),
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    healthcareProvider: row.healthcareProvider
  }
}

export class DrizzleFacilityHealthcareProviderShareRepository
  implements FacilityHealthcareProviderShareRepository
{
  async findByFacility(facilityId: string): Promise<FacilityHealthcareProviderShareRecord[]> {
    const rows = await db
      .select({
        id: facilityHealthcareProviderShares.id,
        facilityId: facilityHealthcareProviderShares.facilityId,
        healthcareProviderId: facilityHealthcareProviderShares.healthcareProviderId,
        sharePercent: facilityHealthcareProviderShares.sharePercent,
        source: facilityHealthcareProviderShares.source,
        createdAt: facilityHealthcareProviderShares.createdAt,
        updatedAt: facilityHealthcareProviderShares.updatedAt,
        healthcareProvider: {
          id: healthcareProviders.id,
          name: healthcareProviders.name,
          type: healthcareProviders.type
        }
      })
      .from(facilityHealthcareProviderShares)
      .innerJoin(
        healthcareProviders,
        eq(facilityHealthcareProviderShares.healthcareProviderId, healthcareProviders.id)
      )
      .where(eq(facilityHealthcareProviderShares.facilityId, facilityId))
      .orderBy(sql`${facilityHealthcareProviderShares.sharePercent}::numeric desc`)

    return rows.map(mapShare)
  }

  async create(data: {
    facilityId: string
    healthcareProviderId: string
    sharePercent: number
  }): Promise<FacilityHealthcareProviderShareRecord> {
    const [share] = await db
      .insert(facilityHealthcareProviderShares)
      .values({
        facilityId: data.facilityId,
        healthcareProviderId: data.healthcareProviderId,
        sharePercent: String(data.sharePercent),
        source: 'MANUAL'
      })
      .returning({ id: facilityHealthcareProviderShares.id })

    const [row] = await db
      .select({
        id: facilityHealthcareProviderShares.id,
        facilityId: facilityHealthcareProviderShares.facilityId,
        healthcareProviderId: facilityHealthcareProviderShares.healthcareProviderId,
        sharePercent: facilityHealthcareProviderShares.sharePercent,
        source: facilityHealthcareProviderShares.source,
        createdAt: facilityHealthcareProviderShares.createdAt,
        updatedAt: facilityHealthcareProviderShares.updatedAt,
        healthcareProvider: {
          id: healthcareProviders.id,
          name: healthcareProviders.name,
          type: healthcareProviders.type
        }
      })
      .from(facilityHealthcareProviderShares)
      .innerJoin(
        healthcareProviders,
        eq(facilityHealthcareProviderShares.healthcareProviderId, healthcareProviders.id)
      )
      .where(eq(facilityHealthcareProviderShares.id, share?.id))

    return mapShare(row!)
  }

  async sumSharePercentForFacility(facilityId: string): Promise<number> {
    const [result] = await db
      .select({ sum: sql<string>`sum(${facilityHealthcareProviderShares.sharePercent}::numeric)` })
      .from(facilityHealthcareProviderShares)
      .where(eq(facilityHealthcareProviderShares.facilityId, facilityId))

    return Number(result?.sum ?? 0)
  }
}
