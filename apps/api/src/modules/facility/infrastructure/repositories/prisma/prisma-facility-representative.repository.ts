import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  FacilityRepresentativeRecord,
  FacilityRepresentativeRepository,
} from "../../../application/interfaces/facility-representative.repository.interface";

function mapRepresentative(row: {
  id: string;
  facilityId: string;
  representativeName: string;
  roleTitle: string | null;
  email: string | null;
  taxId: string | null;
  externalSourceKey: string | null;
  sourceActive: boolean;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): FacilityRepresentativeRecord {
  return {
    id: row.id,
    facilityId: row.facilityId,
    representativeName: row.representativeName,
    roleTitle: row.roleTitle,
    email: row.email,
    taxId: row.taxId,
    externalSourceKey: row.externalSourceKey,
    sourceActive: row.sourceActive,
    confirmedAt: row.confirmedAt,
    confirmedByUserId: row.confirmedByUserId,
    endedAt: row.endedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaFacilityRepresentativeRepository implements FacilityRepresentativeRepository {
  async findByFacilityAndExternalKey(
    facilityId: string,
    externalKey: string
  ): Promise<FacilityRepresentativeRecord | null> {
    const representative = await prisma.facilityRepresentative.findFirst({
      where: { facilityId, externalSourceKey: externalKey, endedAt: null },
    });

    return representative ? mapRepresentative(representative) : null;
  }

  async upsertFromRegistry(params: {
    facilityId: string;
    externalSourceKey: string;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    taxId?: string | null;
  }): Promise<FacilityRepresentativeRecord> {
    const representative = await prisma.facilityRepresentative.upsert({
      where: {
        facilityId_externalSourceKey: {
          facilityId: params.facilityId,
          externalSourceKey: params.externalSourceKey,
        },
      },
      create: {
        facilityId: params.facilityId,
        externalSourceKey: params.externalSourceKey,
        representativeName: params.representativeName,
        roleTitle: params.roleTitle ?? null,
        email: params.email ?? null,
        taxId: params.taxId ?? null,
        sourceActive: true,
        sourceProvider: "registry",
      },
      update: {
        representativeName: params.representativeName,
        roleTitle: params.roleTitle ?? null,
        email: params.email ?? null,
        taxId: params.taxId ?? null,
        sourceActive: true,
      },
    });

    return mapRepresentative(representative);
  }

  async confirm(params: {
    facilityId: string;
    externalSourceKey: string;
    confirmedByUserId: string;
  }): Promise<FacilityRepresentativeRecord> {
    const representative = await prisma.facilityRepresentative.update({
      where: {
        facilityId_externalSourceKey: {
          facilityId: params.facilityId,
          externalSourceKey: params.externalSourceKey,
        },
      },
      data: {
        confirmedAt: new Date(),
        confirmedByUserId: params.confirmedByUserId,
      },
    });

    return mapRepresentative(representative);
  }
}
