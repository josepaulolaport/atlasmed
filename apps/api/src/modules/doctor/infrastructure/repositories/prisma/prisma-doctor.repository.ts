import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type { Prisma } from "@atlasmed/database";
import type {
  DoctorListScopeFilter,
  DoctorRecord,
  DoctorRepository,
} from "../../../application/interfaces/doctor.repository.interface";

function mapDoctor(doctor: {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  doctorClinics: Array<{ clinicId: string }>;
}): DoctorRecord {
  return {
    id: doctor.id,
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    specialty: doctor.specialty,
    clinicIds: doctor.doctorClinics.map((assignment) => assignment.clinicId),
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
    doctorClinics: {
      some: {
        clinicId: { in: clinicIds },
      },
    },
  };
}

const doctorInclude = {
  doctorClinics: {
    select: { clinicId: true },
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
            doctorClinics: {
              some: {
                clinicId: params.clinicId,
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

  async create(data: {
    firstName: string;
    lastName: string;
    specialty?: string | null;
    clinicIds: string[];
  }): Promise<DoctorRecord> {
    const doctor = await prisma.doctor.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        specialty: data.specialty ?? null,
        doctorClinics: {
          create: data.clinicIds.map((clinicId) => ({ clinicId })),
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
      clinicIds?: string[];
    }
  ): Promise<DoctorRecord> {
    const doctor = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (data.clinicIds) {
        await tx.doctorClinic.deleteMany({ where: { doctorId: id } });
        await tx.doctorClinic.createMany({
          data: data.clinicIds.map((clinicId) => ({
            doctorId: id,
            clinicId,
          })),
        });
      }

      return tx.doctor.update({
        where: { id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          specialty: data.specialty,
        },
        include: doctorInclude,
      });
    });

    return mapDoctor(doctor);
  }

  async softDelete(id: string): Promise<void> {
    await prisma.doctor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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
