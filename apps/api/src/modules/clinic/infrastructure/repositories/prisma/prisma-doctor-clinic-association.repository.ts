import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  DoctorClinicAssociationRecord,
  DoctorClinicAssociationRepository,
  DoctorClinicAssociationWithDoctorRecord,
  DoctorClinicView,
} from "../../../application/interfaces/doctor-clinic-association.repository.interface";

function mapAssociation(association: {
  id: string;
  doctorId: string;
  clinicId: string;
  sourceActive: boolean;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
  endedByUserId: string | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DoctorClinicAssociationRecord {
  return {
    id: association.id,
    doctorId: association.doctorId,
    clinicId: association.clinicId,
    sourceActive: association.sourceActive,
    sourceFirstSeenAt: association.sourceFirstSeenAt,
    sourceLastSeenAt: association.sourceLastSeenAt,
    confirmedAt: association.confirmedAt,
    confirmedByUserId: association.confirmedByUserId,
    endedAt: association.endedAt,
    endedByUserId: association.endedByUserId,
    endReason: association.endReason,
    createdAt: association.createdAt,
    updatedAt: association.updatedAt,
  };
}

function buildViewWhere(clinicId: string, view: DoctorClinicView) {
  const base = { clinicId, endedAt: null };

  switch (view) {
    case "source":
      return { ...base, sourceActive: true };
    case "confirmed":
      return { ...base, confirmedAt: { not: null } };
    case "pending":
      return { ...base, sourceActive: true, confirmedAt: null };
    case "all":
      return {
        ...base,
        OR: [{ sourceActive: true }, { confirmedAt: { not: null } }],
      };
  }
}

export class PrismaDoctorClinicAssociationRepository
  implements DoctorClinicAssociationRepository
{
  async findByDoctorAndClinic(
    doctorId: string,
    clinicId: string
  ): Promise<DoctorClinicAssociationRecord | null> {
    const association = await prisma.doctorClinicAssociation.findUnique({
      where: { doctorId_clinicId: { doctorId, clinicId } },
    });

    return association ? mapAssociation(association) : null;
  }

  async findActiveByClinicWithDoctors(params: {
    clinicId: string;
    view: DoctorClinicView;
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    associations: DoctorClinicAssociationWithDoctorRecord[];
    total: number;
  }> {
    const where = {
      ...buildViewWhere(params.clinicId, params.view),
      doctor: {
        deletedAt: null,
        ...(params.search
          ? {
              OR: [
                {
                  firstName: {
                    contains: params.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  lastName: {
                    contains: params.search,
                    mode: "insensitive" as const,
                  },
                },
                {
                  specialty: {
                    contains: params.search,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
    };

    const skip = (params.page - 1) * params.limit;

    const [associations, total] = await Promise.all([
      prisma.doctorClinicAssociation.findMany({
        where,
        include: {
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              specialty: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [{ doctor: { lastName: "asc" } }, { doctor: { firstName: "asc" } }],
        skip,
        take: params.limit,
      }),
      prisma.doctorClinicAssociation.count({ where }),
    ]);

    return {
      associations: associations.map((row) => ({
        ...mapAssociation(row),
        doctor: row.doctor,
      })),
      total,
    };
  }

  async findActiveSourceAssociationsByProvider(sourceProvider: string): Promise<
    Array<{
      association: DoctorClinicAssociationRecord;
      doctorExternalSourceId: string;
      clinicExternalSourceId: string;
    }>
  > {
    const rows = await prisma.doctorClinicAssociation.findMany({
      where: {
        endedAt: null,
        sourceActive: true,
        doctor: { sourceProvider, sourceTracked: true },
        clinic: { sourceProvider, sourceTracked: true },
      },
      include: {
        doctor: { select: { externalSourceId: true } },
        clinic: { select: { externalSourceId: true } },
      },
    });

    return rows
      .filter(
        (row) => row.doctor.externalSourceId && row.clinic.externalSourceId
      )
      .map((row) => ({
        association: mapAssociation(row),
        doctorExternalSourceId: row.doctor.externalSourceId!,
        clinicExternalSourceId: row.clinic.externalSourceId!,
      }));
  }

  async confirmAssociation(params: {
    doctorId: string;
    clinicId: string;
    confirmedByUserId: string;
  }): Promise<DoctorClinicAssociationRecord> {
    const now = new Date();
    const association = await prisma.doctorClinicAssociation.upsert({
      where: {
        doctorId_clinicId: {
          doctorId: params.doctorId,
          clinicId: params.clinicId,
        },
      },
      create: {
        doctorId: params.doctorId,
        clinicId: params.clinicId,
        confirmedAt: now,
        confirmedByUserId: params.confirmedByUserId,
      },
      update: {
        confirmedAt: now,
        confirmedByUserId: params.confirmedByUserId,
        endedAt: null,
        endedByUserId: null,
        endReason: null,
      },
    });

    return mapAssociation(association);
  }

  async manuallyAssociate(params: {
    doctorId: string;
    clinicId: string;
    confirmedByUserId: string;
  }): Promise<DoctorClinicAssociationRecord> {
    return this.confirmAssociation(params);
  }

  async endAssociation(params: {
    doctorId: string;
    clinicId: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<DoctorClinicAssociationRecord | null> {
    const existing = await this.findByDoctorAndClinic(params.doctorId, params.clinicId);

    if (!existing || existing.endedAt) {
      return null;
    }

    return this.endAssociationById({
      associationId: existing.id,
      endedByUserId: params.endedByUserId,
      endReason: params.endReason,
    });
  }

  async upsertSourceAssociation(params: {
    doctorId: string;
    clinicId: string;
    sourceLastSeenAt: Date;
  }): Promise<{ association: DoctorClinicAssociationRecord; created: boolean }> {
    const existing = await prisma.doctorClinicAssociation.findUnique({
      where: {
        doctorId_clinicId: {
          doctorId: params.doctorId,
          clinicId: params.clinicId,
        },
      },
    });

    if (existing) {
      const association = await prisma.doctorClinicAssociation.update({
        where: { id: existing.id },
        data: {
          sourceActive: true,
          sourceLastSeenAt: params.sourceLastSeenAt,
          sourceFirstSeenAt: existing.sourceFirstSeenAt ?? params.sourceLastSeenAt,
          endedAt: null,
          endedByUserId: null,
          endReason: null,
        },
      });

      return { association: mapAssociation(association), created: false };
    }

    const association = await prisma.doctorClinicAssociation.create({
      data: {
        doctorId: params.doctorId,
        clinicId: params.clinicId,
        sourceActive: true,
        sourceFirstSeenAt: params.sourceLastSeenAt,
        sourceLastSeenAt: params.sourceLastSeenAt,
      },
    });

    return { association: mapAssociation(association), created: true };
  }

  async markSourceInactive(params: {
    associationId: string;
    sourceLastSeenAt: Date;
  }): Promise<DoctorClinicAssociationRecord> {
    const association = await prisma.doctorClinicAssociation.update({
      where: { id: params.associationId },
      data: {
        sourceActive: false,
        sourceLastSeenAt: params.sourceLastSeenAt,
      },
    });

    return mapAssociation(association);
  }

  async restoreSourceActive(associationId: string): Promise<DoctorClinicAssociationRecord> {
    const association = await prisma.doctorClinicAssociation.update({
      where: { id: associationId },
      data: { sourceActive: true },
    });

    return mapAssociation(association);
  }

  async endAssociationById(params: {
    associationId: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<DoctorClinicAssociationRecord> {
    const association = await prisma.doctorClinicAssociation.update({
      where: { id: params.associationId },
      data: {
        endedAt: new Date(),
        endedByUserId: params.endedByUserId,
        endReason: params.endReason,
        sourceActive: false,
      },
    });

    return mapAssociation(association);
  }

  async createConfirmedAssociations(params: {
    doctorId: string;
    clinicIds: string[];
    confirmedByUserId?: string;
  }): Promise<void> {
    const now = new Date();

    for (const clinicId of params.clinicIds) {
      await prisma.doctorClinicAssociation.upsert({
        where: {
          doctorId_clinicId: { doctorId: params.doctorId, clinicId },
        },
        create: {
          doctorId: params.doctorId,
          clinicId,
          confirmedAt: now,
          confirmedByUserId: params.confirmedByUserId ?? null,
        },
        update: {
          confirmedAt: now,
          confirmedByUserId: params.confirmedByUserId ?? null,
          endedAt: null,
          endedByUserId: null,
          endReason: null,
        },
      });
    }
  }
}
