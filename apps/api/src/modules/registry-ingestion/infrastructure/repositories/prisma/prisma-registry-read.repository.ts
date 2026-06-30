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
    const professionals = await prisma.registryProfessional.findMany({
      where: { professionalId: { in: professionalIds } },
    });

    const professionalById = new Map(professionals.map((p) => [p.professionalId, p]));

    return associations
      .map((association) => {
        const professional = professionalById.get(association.professionalId);
        if (!professional) {
          return null;
        }

        return projectRegistryProfessional({
          professionalId: professional.professionalId,
          fullName: professional.fullName,
          socialName: professional.socialName,
          occupationCode: association.occupationCode,
          municipalityId: association.municipalityId,
          employmentTypeCode: association.employmentTypeCode,
          startDate: association.startDate,
          terminationDate: association.terminationDate,
          lastUpdatedDate: association.lastUpdatedDate,
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
