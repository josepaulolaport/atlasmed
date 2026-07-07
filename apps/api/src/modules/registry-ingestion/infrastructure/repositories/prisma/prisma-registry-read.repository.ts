import { prisma } from "../../../../../infrastructure/database/prisma.client";
import type {
  RegistryReadRepository,
  RegistryFacilityProjection,
  RegistryProfessionalProjection,
  RegistryRepresentativeProjection,
} from "../../../application/interfaces/registry-read.repository.interface";
import {
  projectRegistryFacility,
  projectRegistryProfessional,
  projectRegistryRepresentative,
} from "../../../application/services/registry-projection.service";

function pickWorkloadCrm(
  workloads: Array<{
    professionalCouncilCode: string | null;
    licenseNumber: string | null;
    licenseState: string | null;
    occupationCode: string;
    employmentTypeCode: string;
    serviceType: string;
  }>,
  occupationCode: string,
  employmentTypeCode: string | null
) {
  const matching = workloads.filter((row) => row.occupationCode === occupationCode);
  const candidates =
    employmentTypeCode === null
      ? matching
      : matching.filter((row) => row.employmentTypeCode === employmentTypeCode);

  const withLicense = candidates.find(
    (row) => row.licenseNumber || row.licenseState || row.professionalCouncilCode
  );

  return withLicense ?? candidates[0] ?? matching[0] ?? workloads[0] ?? null;
}

export class PrismaRegistryReadRepository implements RegistryReadRepository {
  async findFacilityByRegistryId(
    registryFacilityId: string
  ): Promise<RegistryFacilityProjection | null> {
    const row = await prisma.registryFacility.findUnique({
      where: { facilityId: registryFacilityId },
    });

    return row ? projectRegistryFacility(row) : null;
  }

  async findProfessionalsByFacility(
    registryFacilityId: string
  ): Promise<RegistryProfessionalProjection[]> {
    const associations = await prisma.registryFacilityProfessional.findMany({
      where: { facilityId: registryFacilityId },
    });

    if (associations.length === 0) {
      return [];
    }

    const professionalIds = [...new Set(associations.map((a) => a.professionalId))];
    const [professionals, workloads] = await Promise.all([
      prisma.registryProfessional.findMany({
        where: { professionalId: { in: professionalIds } },
      }),
      prisma.registryProfessionalWorkload.findMany({
        where: {
          facilityId: registryFacilityId,
          professionalId: { in: professionalIds },
        },
      }),
    ]);

    const professionalById = new Map(professionals.map((p) => [p.professionalId, p]));
    const workloadsByProfessionalId = new Map<string, typeof workloads>();

    for (const workload of workloads) {
      const existing = workloadsByProfessionalId.get(workload.professionalId) ?? [];
      existing.push(workload);
      workloadsByProfessionalId.set(workload.professionalId, existing);
    }

    return associations
      .map((association) => {
        const professional = professionalById.get(association.professionalId);
        if (!professional) {
          return null;
        }

        const workload = pickWorkloadCrm(
          workloadsByProfessionalId.get(association.professionalId) ?? [],
          association.occupationCode,
          association.employmentTypeCode
        );

        return projectRegistryProfessional({
          professionalId: professional.professionalId,
          fullName: professional.fullName,
          socialName: professional.socialName,
          taxId: professional.taxId,
          occupationCode: association.occupationCode,
          municipalityId: association.municipalityId,
          employmentTypeCode: association.employmentTypeCode,
          startDate: association.startDate,
          terminationDate: association.terminationDate,
          lastUpdatedDate: association.lastUpdatedDate,
          crmCouncil: workload?.professionalCouncilCode ?? null,
          crmNumber: workload?.licenseNumber ?? null,
          crmState: workload?.licenseState ?? null,
        });
      })
      .filter((row): row is RegistryProfessionalProjection => row !== null);
  }

  async findRepresentativesByFacility(
    registryFacilityId: string
  ): Promise<RegistryRepresentativeProjection[]> {
    const row = await prisma.registryFacilityRepresentative.findUnique({
      where: { facilityId: registryFacilityId },
    });

    return row ? [projectRegistryRepresentative(row)] : [];
  }
}
