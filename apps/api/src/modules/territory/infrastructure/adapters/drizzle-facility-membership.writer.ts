import { facilities } from '@atlasmed/database'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../../../../infrastructure/database/db'
import type {
  ClinicMembershipTarget,
  ClinicMembershipWriter
} from '../../application/services/territory-membership.service'

export class DrizzleClinicMembershipWriter implements ClinicMembershipWriter {
  async updateTerritoryMembership(
    facilityId: string,
    data: {
      territoryId: string | null
      territoryAssignmentStatus: 'assigned' | 'unassigned' | 'ambiguous'
      territoryAssignmentSource: 'geo' | 'manual'
    }
  ): Promise<void> {
    await db
      .update(facilities)
      .set({
        territoryId: data.territoryId,
        territoryAssignmentStatus: data.territoryAssignmentStatus,
        territoryAssignmentSource: data.territoryAssignmentSource,
        updatedAt: new Date()
      })
      .where(eq(facilities.id, facilityId))
  }

  async findClinicsForMembership(params?: {
    facilityIds?: string[]
    territoryIds?: string[]
    boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number }
  }): Promise<ClinicMembershipTarget[]> {
    const conditions = [isNull(facilities.deactivatedAt)]

    if (params?.facilityIds?.length) {
      conditions.push(inArray(facilities.id, params.facilityIds))
    }
    if (params?.territoryIds?.length) {
      conditions.push(inArray(facilities.territoryId, params.territoryIds))
    }
    if (params?.boundingBox) {
      const { minLng, maxLng, minLat, maxLat } = params.boundingBox
      conditions.push(
        sql`ST_X(${facilities.location}::geometry) BETWEEN ${minLng} AND ${maxLng}`,
        sql`ST_Y(${facilities.location}::geometry) BETWEEN ${minLat} AND ${maxLat}`
      )
    }

    const rows = await db
      .select({
        id: facilities.id,
        lat: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
        lng: sql<number | null>`ST_X(${facilities.location}::geometry)`,
        territoryId: facilities.territoryId,
        territoryAssignmentSource: facilities.territoryAssignmentSource,
        territoryAssignmentStatus: facilities.territoryAssignmentStatus
      })
      .from(facilities)
      .where(and(...conditions))

    return rows
  }
}
