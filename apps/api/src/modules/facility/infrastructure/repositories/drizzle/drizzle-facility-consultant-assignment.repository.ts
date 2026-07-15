import { facilityConsultantAssignments } from '@atlasmed/database'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '../../../../../infrastructure/database/db'
import type {
  FacilityConsultantAssignmentRecord,
  FacilityConsultantAssignmentRepository
} from '../../../application/interfaces/facility-consultant-assignment.repository.interface'

type AssignmentRow = typeof facilityConsultantAssignments.$inferSelect

function mapAssignment(row: AssignmentRow): FacilityConsultantAssignmentRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    userId: row.userId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    assignedByUserId: row.assignedByUserId,
    endReason: row.endReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export class DrizzleFacilityConsultantAssignmentRepository
  implements FacilityConsultantAssignmentRepository
{
  async findByFacility(facilityId: string): Promise<FacilityConsultantAssignmentRecord[]> {
    const rows = await db
      .select()
      .from(facilityConsultantAssignments)
      .where(eq(facilityConsultantAssignments.facilityId, facilityId))
      .orderBy(desc(facilityConsultantAssignments.startedAt))

    return rows.map(mapAssignment)
  }

  async findCurrentByFacility(
    facilityId: string
  ): Promise<FacilityConsultantAssignmentRecord | null> {
    const [assignment] = await db
      .select()
      .from(facilityConsultantAssignments)
      .where(
        and(
          eq(facilityConsultantAssignments.facilityId, facilityId),
          isNull(facilityConsultantAssignments.endedAt)
        )
      )
      .orderBy(desc(facilityConsultantAssignments.startedAt))
      .limit(1)

    return assignment ? mapAssignment(assignment) : null
  }

  async assign(params: {
    facilityId: string
    userId: string
    assignedByUserId: string
  }): Promise<FacilityConsultantAssignmentRecord> {
    const current = await this.findCurrentByFacility(params.facilityId)

    if (current) {
      await db
        .update(facilityConsultantAssignments)
        .set({ endedAt: new Date(), endReason: 'reassigned', updatedAt: new Date() })
        .where(eq(facilityConsultantAssignments.id, current.id))
    }

    const [assignment] = await db
      .insert(facilityConsultantAssignments)
      .values({
        facilityId: params.facilityId,
        userId: params.userId,
        assignedByUserId: params.assignedByUserId
      })
      .returning()

    return mapAssignment(assignment!)
  }
}
