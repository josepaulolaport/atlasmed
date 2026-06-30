import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  FacilityHealthcareProviderShareRecord,
  FacilityHealthcareProviderShareRepository,
} from "../../../application/interfaces/facility-healthcare-provider-share.repository.interface";

function mapShare(row: {
  id: string;
  facilityId: string;
  healthcareProviderId: string;
  sharePercent: number;
  source: "MANUAL" | "REGISTRY" | "IMPORT";
  createdAt: Date;
  updatedAt: Date;
  healthcareProvider: { id: string; name: string; type: string };
}): FacilityHealthcareProviderShareRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    healthcareProviderId: row.healthcareProviderId,
    sharePercent: row.sharePercent,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    healthcareProvider: row.healthcareProvider,
  };
}

export class PrismaFacilityHealthcareProviderShareRepository
  implements FacilityHealthcareProviderShareRepository
{
  async findByFacility(facilityId: string): Promise<FacilityHealthcareProviderShareRecord[]> {
    const shares = await prisma.facilityHealthcareProviderShare.findMany({
      where: { facilityId },
      include: {
        healthcareProvider: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { sharePercent: "desc" },
    });

    return shares.map(mapShare);
  }

  async create(data: {
    facilityId: string;
    healthcareProviderId: string;
    sharePercent: number;
  }): Promise<FacilityHealthcareProviderShareRecord> {
    const share = await prisma.facilityHealthcareProviderShare.create({
      data: {
        facilityId: data.facilityId,
        healthcareProviderId: data.healthcareProviderId,
        sharePercent: data.sharePercent,
        source: "MANUAL",
      },
      include: {
        healthcareProvider: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return mapShare(share);
  }

  async sumSharePercentForFacility(facilityId: string): Promise<number> {
    const result = await prisma.facilityHealthcareProviderShare.aggregate({
      where: { facilityId },
      _sum: { sharePercent: true },
    });

    return result._sum.sharePercent ?? 0;
  }
}
