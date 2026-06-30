import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  FacilityConsultantAssignmentRecord,
  FacilityConsultantAssignmentRepository,
} from "../../../application/interfaces/facility-consultant-assignment.repository.interface";

function mapAssignment(row: {
  id: string;
  facilityId: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  assignedByUserId: string | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): FacilityConsultantAssignmentRecord {
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

export class PrismaFacilityConsultantAssignmentRepository
  implements FacilityConsultantAssignmentRepository
{
  async findByFacility(facilityId: string): Promise<FacilityConsultantAssignmentRecord[]> {
    const assignments = await prisma.facilityConsultantAssignment.findMany({
      where: { facilityId },
      orderBy: { startedAt: "desc" },
    });

    return assignments.map(mapAssignment);
  }

  async findCurrentByFacility(
    facilityId: string
  ): Promise<FacilityConsultantAssignmentRecord | null> {
    const assignment = await prisma.facilityConsultantAssignment.findFirst({
      where: { facilityId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    return assignment ? mapAssignment(assignment) : null;
  }

  async assign(params: {
    facilityId: string;
    userId: string;
    assignedByUserId: string;
  }): Promise<FacilityConsultantAssignmentRecord> {
    const current = await this.findCurrentByFacility(params.facilityId);

    if (current) {
      await prisma.facilityConsultantAssignment.update({
        where: { id: current.id },
        data: {
          endedAt: new Date(),
          endReason: "reassigned",
        },
      });
    }

    const assignment = await prisma.facilityConsultantAssignment.create({
      data: {
        facilityId: params.facilityId,
        userId: params.userId,
        assignedByUserId: params.assignedByUserId,
      },
    });

    return mapAssignment(assignment);
  }
}
