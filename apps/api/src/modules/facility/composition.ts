import { geocodingPort } from '../maps/composition'
import { professionalRepositories } from '../professional/composition'
import { DrizzleRegistryReadRepository } from '../registry-ingestion/infrastructure/repositories/drizzle/drizzle-registry-read.repository'
import { territoryMembershipService } from '../territory/composition'
import { FacilityGeocodingService } from './application/services/facility-geocoding.service'
import {
  CreateFacilityConformityRecordUseCase,
  ListConformityRequirementsUseCase,
  ListFacilityConformityRecordsUseCase
} from './application/use-cases/conformity.use-cases'
import {
  CreateFacilityUseCase,
  DeleteFacilityUseCase,
  GetFacilityUseCase,
  ListFacilitiesUseCase,
  UpdateFacilityUseCase
} from './application/use-cases/facility.use-cases'
import {
  ConfirmProfessionalAtFacilityUseCase,
  EndFacilityProfessionalUseCase,
  GetFacilityProfessionalContextUseCase,
  ListFacilityProfessionalsUseCase,
  ManuallyAssociateProfessionalUseCase,
  UpdateFacilityProfessionalRoleUseCase
} from './application/use-cases/facility-professional.use-cases'
import {
  AssignFacilityConsultantUseCase,
  ConfirmRegistryProfessionalUseCase,
  ConfirmRegistryRepresentativeUseCase,
  ListFacilityConsultantAssignmentsUseCase
} from './application/use-cases/facility-registry.use-cases'
import {
  CreateFacilityVisitUseCase,
  ListFacilityVisitsUseCase
} from './application/use-cases/visit.use-cases'
import { DrizzleConformityRepository } from './infrastructure/repositories/drizzle/drizzle-conformity.repository'
import { DrizzleFacilityRepository } from './infrastructure/repositories/drizzle/drizzle-facility.repository'
import { DrizzleFacilityConsultantAssignmentRepository } from './infrastructure/repositories/drizzle/drizzle-facility-consultant-assignment.repository'
import { DrizzleFacilityProfessionalRepository } from './infrastructure/repositories/drizzle/drizzle-facility-professional.repository'
import { DrizzleFacilityRepresentativeRepository } from './infrastructure/repositories/drizzle/drizzle-facility-representative.repository'
import { DrizzleVisitRepository } from './infrastructure/repositories/drizzle/drizzle-visit.repository'
import { DrizzleTerritoryScopePort } from './infrastructure/scope/drizzle-territory-scope.port'

const registryReadRepository = new DrizzleRegistryReadRepository()

export const facilityRepositories = {
  facility: new DrizzleFacilityRepository(),
  association: new DrizzleFacilityProfessionalRepository(),
  representative: new DrizzleFacilityRepresentativeRepository(),
  consultantAssignment: new DrizzleFacilityConsultantAssignmentRepository(),
  conformity: new DrizzleConformityRepository(),
  visit: new DrizzleVisitRepository()
}

export const facilityTerritoryScopePort = new DrizzleTerritoryScopePort(
  facilityRepositories.facility
)

export const facilityGeocodingService = new FacilityGeocodingService({
  facilityRepository: facilityRepositories.facility,
  geocodingPort
})

async function handleFacilityLocationChanged(facilityId: string): Promise<void> {
  await facilityGeocodingService.ensureCoordinatesPersisted(facilityId)
  await territoryMembershipService.assignFacilityById(facilityId)
}

const facilityMembershipDeps = {
  facilityRepository: facilityRepositories.facility,
  facilityGeocodingService,
  onFacilityLocationChanged: handleFacilityLocationChanged
}

export const facilityUseCases = {
  listFacilities: () => new ListFacilitiesUseCase(facilityMembershipDeps),
  getFacility: () => new GetFacilityUseCase(facilityMembershipDeps),
  createFacility: () => new CreateFacilityUseCase(facilityMembershipDeps),
  updateFacility: () => new UpdateFacilityUseCase(facilityMembershipDeps),
  deleteFacility: () => new DeleteFacilityUseCase(facilityMembershipDeps),
  listFacilityProfessionals: () =>
    new ListFacilityProfessionalsUseCase({
      facilityProfessionalRepository: facilityRepositories.association
    }),
  confirmProfessionalAtFacility: () =>
    new ConfirmProfessionalAtFacilityUseCase({
      facilityProfessionalRepository: facilityRepositories.association
    }),
  manuallyAssociateProfessional: () =>
    new ManuallyAssociateProfessionalUseCase({
      facilityProfessionalRepository: facilityRepositories.association
    }),
  endFacilityProfessional: () =>
    new EndFacilityProfessionalUseCase({
      facilityProfessionalRepository: facilityRepositories.association
    }),
  getFacilityProfessionalContext: () =>
    new GetFacilityProfessionalContextUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
      professionalRepository: professionalRepositories.professional
    }),
  updateFacilityProfessionalRole: () =>
    new UpdateFacilityProfessionalRoleUseCase({
      facilityProfessionalRepository: facilityRepositories.association
    }),
  confirmRegistryProfessional: () =>
    new ConfirmRegistryProfessionalUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
      facilityRepository: facilityRepositories.facility,
      registryReadRepository
    }),
  confirmRegistryRepresentative: () =>
    new ConfirmRegistryRepresentativeUseCase({
      facilityRepresentativeRepository: facilityRepositories.representative,
      facilityRepository: facilityRepositories.facility,
      registryReadRepository
    }),
  listConsultantAssignments: () =>
    new ListFacilityConsultantAssignmentsUseCase({
      consultantAssignmentRepository: facilityRepositories.consultantAssignment
    }),
  assignConsultant: () =>
    new AssignFacilityConsultantUseCase({
      consultantAssignmentRepository: facilityRepositories.consultantAssignment
    }),
  listConformityRequirements: () =>
    new ListConformityRequirementsUseCase({
      conformityRepository: facilityRepositories.conformity
    }),
  listFacilityConformityRecords: () =>
    new ListFacilityConformityRecordsUseCase({
      conformityRepository: facilityRepositories.conformity
    }),
  createFacilityConformityRecord: () =>
    new CreateFacilityConformityRecordUseCase({
      conformityRepository: facilityRepositories.conformity
    }),
  listFacilityVisits: () =>
    new ListFacilityVisitsUseCase({
      visitRepository: facilityRepositories.visit
    }),
  createFacilityVisit: () =>
    new CreateFacilityVisitUseCase({
      visitRepository: facilityRepositories.visit
    })
}

export { territoryMembershipService }
