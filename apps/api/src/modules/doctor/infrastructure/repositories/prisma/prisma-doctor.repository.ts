import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  DoctorListScopeFilter,
  DoctorRecord,
  DoctorRepository,
  DoctorSourceUpsertInput,
} from "../../../application/interfaces/doctor.repository.interface";

function mapDoctor(doctor: {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  sourceProvider: string | null;
  externalSourceId: string | null;
  sourceContentHash: string | null;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  sourcePresent: boolean;
  sourceTracked: boolean;
  manuallyEditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  clinicAssociations: Array<{ clinicId: string; endedAt: Date | null }>;
}): DoctorRecord {
  return {
    id: doctor.id,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    specialty: doctor.specialty,
    sourceProvider: doctor.sourceProvider,
    externalSourceId: doctor.externalSourceId,
    sourceContentHash: doctor.sourceContentHash,
    sourceFirstSeenAt: doctor.sourceFirstSeenAt,
    sourceLastSeenAt: doctor.sourceLastSeenAt,
    sourcePresent: doctor.sourcePresent,
    sourceTracked: doctor.sourceTracked,
    manuallyEditedAt: doctor.manuallyEditedAt,
    clinicIds: doctor.clinicAssociations
      .filter((a) => a.endedAt === null)
      .map((a) => a.clinicId),
    createdAt: doctor.createdAt,
    updatedAt: doctor.updatedAt,
    deletedAt: doctor.deletedAt,
  };
}

function buildScopeFilter(scope: DoctorListScopeFilter) {
  if (scope.isGlobal) {
    return {};
  }

  const clinicIds = scope.clinicIds?.length ? scope.clinicIds : ["__none__"];

  return {
    clinicAssociations: {
      some: {
        clinicId: { in: clinicIds },
        endedAt: null,
      },
    },
  };
}

const doctorInclude = {
  clinicAssociations: {
    select: { clinicId: true, endedAt: true },
  },
} as const;

export class PrismaDoctorRepository implements DoctorRepository {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
    clinicId?: string;
    scope: DoctorListScopeFilter;
  }): Promise<{ doctors: DoctorRecord[]; total: number }> {
    const where = {
      deletedAt: null,
      ...buildScopeFilter(params.scope),
      ...(params.clinicId
        ? {
            clinicAssociations: {
              some: {
                clinicId: params.clinicId,
                endedAt: null,
              },
            },
          }
        : {}),
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
    };

    const skip = (params.page - 1) * params.limit;

    const [doctors, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: doctorInclude,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: params.limit,
      }),
      prisma.doctor.count({ where }),
    ]);

    return {
      doctors: doctors.map(mapDoctor),
      total,
    };
  }

  async findById(id: string): Promise<DoctorRecord | null> {
    const doctor = await prisma.doctor.findFirst({
      where: { id, deletedAt: null },
      include: doctorInclude,
    });

    return doctor ? mapDoctor(doctor) : null;
  }

  async findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<DoctorRecord | null> {
    const doctor = await prisma.doctor.findFirst({
      where: { sourceProvider, externalSourceId, deletedAt: null },
      include: doctorInclude,
    });

    return doctor ? mapDoctor(doctor) : null;
  }

  async findSourceTrackedByProvider(sourceProvider: string): Promise<DoctorRecord[]> {
    const doctors = await prisma.doctor.findMany({
      where: { sourceProvider, sourceTracked: true, deletedAt: null },
      include: doctorInclude,
    });

    return doctors.map(mapDoctor);
  }

  async create(data: {
    firstName: string;
    lastName: string;
    specialty?: string | null;
    clinicIds: string[];
    confirmedByUserId?: string;
  }): Promise<DoctorRecord> {
    const now = new Date();

    const doctor = await prisma.doctor.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        specialty: data.specialty ?? null,
        clinicAssociations: {
          create: data.clinicIds.map((clinicId) => ({
            clinicId,
            confirmedAt: now,
            confirmedByUserId: data.confirmedByUserId ?? null,
          })),
        },
      },
      include: doctorInclude,
    });

    return mapDoctor(doctor);
  }

  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      specialty?: string | null;
      manuallyEditedAt?: Date;
    }
  ): Promise<DoctorRecord> {
    const doctor = await prisma.doctor.update({
      where: { id },
      data,
      include: doctorInclude,
    });

    return mapDoctor(doctor);
  }

  async softDelete(id: string): Promise<void> {
    await prisma.doctor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void> {
    await prisma.doctor.update({
      where: { id },
      data: {
        sourcePresent: false,
        sourceLastSeenAt,
      },
    });
  }

  async upsertFromSource(input: DoctorSourceUpsertInput): Promise<{
    doctor: DoctorRecord;
    created: boolean;
    updated: boolean;
  }> {
    const existing = await prisma.doctor.findFirst({
      where: {
        sourceProvider: input.sourceProvider,
        externalSourceId: input.externalSourceId,
      },
      include: doctorInclude,
    });

    if (!existing) {
      const doctor = await prisma.doctor.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          specialty: input.specialty,
          sourceProvider: input.sourceProvider,
          externalSourceId: input.externalSourceId,
          sourceContentHash: input.sourceContentHash,
          sourceFirstSeenAt: input.sourceLastSeenAt,
          sourceLastSeenAt: input.sourceLastSeenAt,
          sourcePresent: true,
          sourceTracked: true,
        },
        include: doctorInclude,
      });

      return { doctor: mapDoctor(doctor), created: true, updated: false };
    }

    const hashUnchanged = existing.sourceContentHash === input.sourceContentHash;
    const updateData: Record<string, unknown> = {
      sourceContentHash: input.sourceContentHash,
      sourceLastSeenAt: input.sourceLastSeenAt,
      sourcePresent: true,
      sourceTracked: true,
    };

    if (!existing.manuallyEditedAt) {
      updateData.firstName = input.firstName;
      updateData.lastName = input.lastName;
      updateData.specialty = input.specialty;
    }

    const doctor = await prisma.doctor.update({
      where: { id: existing.id },
      data: updateData,
      include: doctorInclude,
    });

    return {
      doctor: mapDoctor(doctor),
      created: false,
      updated: !hashUnchanged || !existing.manuallyEditedAt,
    };
  }

  async findExistingClinicIds(clinicIds: string[]): Promise<string[]> {
    if (clinicIds.length === 0) {
      return [];
    }

    const clinics = await prisma.clinic.findMany({
      where: {
        id: { in: clinicIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    return clinics.map((clinic: { id: string }) => clinic.id);
  }
}
