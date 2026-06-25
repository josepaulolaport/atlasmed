import { prisma } from "../../../../infrastructure/database/prisma.client";
import type {
  ClinicMembershipTarget,
  ClinicMembershipWriter,
} from "../../application/services/territory-membership.service";

export class PrismaClinicMembershipWriter implements ClinicMembershipWriter {
  async updateTerritoryMembership(
    clinicId: string,
    data: {
      territoryId: string | null;
      territoryAssignmentStatus: "assigned" | "unassigned" | "ambiguous";
      territoryAssignmentSource: "geo" | "manual";
    }
  ): Promise<void> {
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        territoryId: data.territoryId,
        territoryAssignmentStatus: data.territoryAssignmentStatus,
        territoryAssignmentSource: data.territoryAssignmentSource,
      },
    });
  }

  async findClinicsForMembership(params?: {
    clinicIds?: string[];
    territoryIds?: string[];
    boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  }): Promise<ClinicMembershipTarget[]> {
    const clinics = await prisma.clinic.findMany({
      where: {
        deletedAt: null,
        ...(params?.clinicIds ? { id: { in: params.clinicIds } } : {}),
        ...(params?.territoryIds ? { territoryId: { in: params.territoryIds } } : {}),
        ...(params?.boundingBox
          ? {
              lat: {
                gte: params.boundingBox.minLat,
                lte: params.boundingBox.maxLat,
              },
              lng: {
                gte: params.boundingBox.minLng,
                lte: params.boundingBox.maxLng,
              },
            }
          : {}),
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        territoryId: true,
        territoryAssignmentSource: true,
        territoryAssignmentStatus: true,
      },
    });

    return clinics;
  }
}
