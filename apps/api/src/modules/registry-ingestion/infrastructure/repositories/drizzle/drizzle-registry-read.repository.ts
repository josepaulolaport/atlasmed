import { db } from "../../../../../infrastructure/database/db";
import {
  registryFacilities,
  registryFacilityProfessionals,
  registryFacilityRepresentatives,
  registryProfessionals,
} from "@atlasmed/database";
import { eq, inArray, sql } from "drizzle-orm";
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

export class DrizzleRegistryReadRepository implements RegistryReadRepository {
  async findFacilityByRegistryId(
    registryFacilityId: string
  ): Promise<RegistryFacilityProjection | null> {
    const rows = await db
      .select({
        facilityId: registryFacilities.facilityId,
        cnesCode: registryFacilities.cnesCode,
        legalName: registryFacilities.legalName,
        tradeName: registryFacilities.tradeName,
        streetAddress: registryFacilities.streetAddress,
        streetNumber: registryFacilities.streetNumber,
        addressComplement: registryFacilities.addressComplement,
        neighborhood: registryFacilities.neighborhood,
        postalCode: registryFacilities.postalCode,
        phoneNumber: registryFacilities.phoneNumber,
        faxNumber: registryFacilities.faxNumber,
        email: registryFacilities.email,
        websiteUrl: registryFacilities.websiteUrl,
        latitude: sql<number | null>`ST_Y(${registryFacilities.location}::geometry)`,
        longitude: sql<number | null>`ST_X(${registryFacilities.location}::geometry)`,
        cnpj: registryFacilities.taxIdCnpj,
        cpf: registryFacilities.taxIdCpf,
        facilityTypeCode: registryFacilities.facilityTypeCode,
        deactivationReasonCode: registryFacilities.deactivationReasonCode,
        lastUpdatedDate: registryFacilities.lastUpdatedDate,
      })
      .from(registryFacilities)
      .where(eq(registryFacilities.facilityId, registryFacilityId));

    return rows[0] ? projectRegistryFacility(rows[0]) : null;
  }

  async findProfessionalsByFacility(
    registryFacilityId: string
  ): Promise<RegistryProfessionalProjection[]> {
    const associations = await db
      .select()
      .from(registryFacilityProfessionals)
      .where(eq(registryFacilityProfessionals.facilityId, registryFacilityId));

    if (associations.length === 0) {
      return [];
    }

    const professionalIds = [...new Set(associations.map((a) => a.professionalId))];
    const professionals = await db
      .select()
      .from(registryProfessionals)
      .where(inArray(registryProfessionals.professionalId, professionalIds));

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
          taxId: professional.taxId,
          occupationCode: association.occupationCode,
          municipalityId: association.municipalityId,
          employmentTypeCode: association.employmentTypeCode,
          startDate: association.startDate,
          terminationDate: association.terminationDate,
          lastUpdatedDate: association.lastUpdatedDate,
          crmCouncil: null,
          crmNumber: null,
          crmState: null,
        });
      })
      .filter((row): row is RegistryProfessionalProjection => row !== null);
  }

  async findRepresentativesByFacility(
    registryFacilityId: string
  ): Promise<RegistryRepresentativeProjection[]> {
    const rows = await db
      .select()
      .from(registryFacilityRepresentatives)
      .where(eq(registryFacilityRepresentatives.facilityId, registryFacilityId))
      .limit(1);

    return rows[0] ? [projectRegistryRepresentative(rows[0])] : [];
  }
}
