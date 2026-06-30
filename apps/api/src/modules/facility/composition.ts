import { PrismaFacilityRepository } from "./infrastructure/repositories/prisma/prisma-facility.repository";
import { PrismaFacilityProfessionalRepository } from "./infrastructure/repositories/prisma/prisma-facility-professional.repository";
import { PrismaFacilityRepresentativeRepository } from "./infrastructure/repositories/prisma/prisma-facility-representative.repository";
import { PrismaFacilityConsultantAssignmentRepository } from "./infrastructure/repositories/prisma/prisma-facility-consultant-assignment.repository";
import { PrismaConformityRepository } from "./infrastructure/repositories/prisma/prisma-conformity.repository";
import { PrismaTerritoryScopePort } from "./infrastructure/scope/prisma-territory-scope.port";
import {
  CreateFacilityUseCase,
  DeleteFacilityUseCase,
  GetFacilityUseCase,
  ListFacilitiesUseCase,
  UpdateFacilityUseCase,
} from "./application/use-cases/facility.use-cases";
import {
  ConfirmProfessionalAtFacilityUseCase,
  EndFacilityProfessionalUseCase,
  ListFacilityProfessionalsUseCase,
  ManuallyAssociateProfessionalUseCase,
} from "./application/use-cases/facility-professional.use-cases";
import {
  AssignFacilityConsultantUseCase,
  ConfirmRegistryProfessionalUseCase,
  ConfirmRegistryRepresentativeUseCase,
  ListFacilityConsultantAssignmentsUseCase,
} from "./application/use-cases/facility-registry.use-cases";
import {
  CreateFacilityConformityRecordUseCase,
  ListConformityRequirementsUseCase,
  ListFacilityConformityRecordsUseCase,
} from "./application/use-cases/conformity.use-cases";
import {
  territoryMembershipService,
} from "../territory/composition";
import { geocodingPort } from "../maps/composition";
import { FacilityGeocodingService } from "./application/services/facility-geocoding.service";
import { PrismaRegistryReadRepository } from "../registry-ingestion/infrastructure/repositories/prisma/prisma-registry-read.repository";

const registryReadRepository = new PrismaRegistryReadRepository();

export const facilityRepositories = {
  facility: new PrismaFacilityRepository(),
  association: new PrismaFacilityProfessionalRepository(),
  representative: new PrismaFacilityRepresentativeRepository(),
  consultantAssignment: new PrismaFacilityConsultantAssignmentRepository(),
  conformity: new PrismaConformityRepository(),
};

export const facilityTerritoryScopePort = new PrismaTerritoryScopePort(
  facilityRepositories.facility
);

export const facilityGeocodingService = new FacilityGeocodingService({
  facilityRepository: facilityRepositories.facility,
  geocodingPort,
});

async function handleFacilityLocationChanged(facilityId: string): Promise<void> {
  await facilityGeocodingService.ensureCoordinatesPersisted(facilityId);
  await territoryMembershipService.assignFacilityById(facilityId);
}

const facilityMembershipDeps = {
  facilityRepository: facilityRepositories.facility,
  facilityGeocodingService,
  onFacilityLocationChanged: handleFacilityLocationChanged,
};

export const facilityUseCases = {
  listFacilities: () => new ListFacilitiesUseCase(facilityMembershipDeps),
  getFacility: () => new GetFacilityUseCase(facilityMembershipDeps),
  createFacility: () => new CreateFacilityUseCase(facilityMembershipDeps),
  updateFacility: () => new UpdateFacilityUseCase(facilityMembershipDeps),
  deleteFacility: () => new DeleteFacilityUseCase(facilityMembershipDeps),
  listFacilityProfessionals: () =>
    new ListFacilityProfessionalsUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
    }),
  confirmProfessionalAtFacility: () =>
    new ConfirmProfessionalAtFacilityUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
    }),
  manuallyAssociateProfessional: () =>
    new ManuallyAssociateProfessionalUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
    }),
  endFacilityProfessional: () =>
    new EndFacilityProfessionalUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
    }),
  confirmRegistryProfessional: () =>
    new ConfirmRegistryProfessionalUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
      facilityRepository: facilityRepositories.facility,
      registryReadRepository,
    }),
  confirmRegistryRepresentative: () =>
    new ConfirmRegistryRepresentativeUseCase({
      facilityRepresentativeRepository: facilityRepositories.representative,
      facilityRepository: facilityRepositories.facility,
      registryReadRepository,
    }),
  listConsultantAssignments: () =>
    new ListFacilityConsultantAssignmentsUseCase({
      consultantAssignmentRepository: facilityRepositories.consultantAssignment,
    }),
  assignConsultant: () =>
    new AssignFacilityConsultantUseCase({
      consultantAssignmentRepository: facilityRepositories.consultantAssignment,
    }),
  listConformityRequirements: () =>
    new ListConformityRequirementsUseCase({
      conformityRepository: facilityRepositories.conformity,
    }),
  listFacilityConformityRecords: () =>
    new ListFacilityConformityRecordsUseCase({
      conformityRepository: facilityRepositories.conformity,
    }),
  createFacilityConformityRecord: () =>
    new CreateFacilityConformityRecordUseCase({
      conformityRepository: facilityRepositories.conformity,
    }),
};

export { territoryMembershipService };
