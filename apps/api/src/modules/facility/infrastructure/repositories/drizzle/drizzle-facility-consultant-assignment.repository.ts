import {
  facilityConsultantAssignments,
} from "@atlasmed/database";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";
import type {
  FacilityConsultantAssignmentRecord,
  FacilityConsultantAssignmentRepository,
} from "../../../application/interfaces/facility-consultant-assignment.repository.interface";

type AssignmentRow = typeof facilityConsultantAssignments.$inferSelect;

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
    updatedAt: row.updatedAt,
  };
}

export class DrizzleFacilityConsultantAssignmentRepository
  implements FacilityConsultantAssignmentRepository
{
  async findByFacility(facilityId: number): Promise<FacilityConsultantAssignmentRecord[]> {
    const rows = await db
      .select()
      .from(facilityConsultantAssignments)
      .where(eq(facilityConsultantAssignments.facilityId, facilityId))
      .orderBy(desc(facilityConsultantAssignments.startedAt));

    return rows.map(mapAssignment);
  }

  async findCurrentByFacility(
    facilityId: number
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
      .limit(1);

    return assignment ? mapAssignment(assignment) : null;
  }

  async findActiveFacilityIdsByUserId(
    userId: number,
    verticalIds?: number[],
  ): Promise<number[]> {
    const conditions = [
      eq(facilityConsultantAssignments.userId, userId),
      isNull(facilityConsultantAssignments.endedAt),
    ];
    if (verticalIds && verticalIds.length > 0) {
      conditions.push(inArray(facilityConsultantAssignments.verticalId, verticalIds));
    }

    const rows = await db
      .select({ facilityId: facilityConsultantAssignments.facilityId })
      .from(facilityConsultantAssignments)
      .where(and(...conditions));

    return [...new Set(rows.map((row) => row.facilityId))];
  }

  async assign(params: {
    facilityId: number;
    userId: number;
    verticalId: number;
    assignedByUserId: number;
  }): Promise<FacilityConsultantAssignmentRecord> {
    const current = await this.findCurrentByFacility(params.facilityId);

    if (current) {
      await db
        .update(facilityConsultantAssignments)
        .set({ endedAt: new Date(), endReason: "reassigned", updatedAt: new Date() })
        .where(eq(facilityConsultantAssignments.id, current.id));
    }

    const [assignment] = await db
      .insert(facilityConsultantAssignments)
      .values({
        facilityId: params.facilityId,
        userId: params.userId,
        verticalId: params.verticalId,
        assignedByUserId: params.assignedByUserId,
      })
      .returning();

    return mapAssignment(assignment!);
  }

  async endActiveForFacilities(params: {
    facilityIds: number[];
    endReason: string;
  }): Promise<number> {
    if (params.facilityIds.length === 0) return 0;

    const updated = await db
      .update(facilityConsultantAssignments)
      .set({
        endedAt: new Date(),
        endReason: params.endReason,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(facilityConsultantAssignments.facilityId, params.facilityIds),
          isNull(facilityConsultantAssignments.endedAt),
        ),
      )
      .returning({ id: facilityConsultantAssignments.id });

    return updated.length;
  }
}
