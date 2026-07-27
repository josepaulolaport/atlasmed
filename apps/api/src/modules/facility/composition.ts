import { DrizzleFacilityRepository } from "./infrastructure/repositories/drizzle/drizzle-facility.repository";
import { DrizzleFacilityProfessionalRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-professional.repository";
import { DrizzleFacilityRepresentativeRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-representative.repository";
import { DrizzleUserRepresentativeRelationshipRepository } from "./infrastructure/repositories/drizzle/drizzle-user-representative-relationship.repository";
import { DrizzleFacilityConsultantAssignmentRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-consultant-assignment.repository";
import { DrizzleFacilityNoteRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-note.repository";
import { DrizzleFacilityPhotoRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-photo.repository";
import { DrizzleConformityRepository } from "./infrastructure/repositories/drizzle/drizzle-conformity.repository";
import { DrizzleCadastroSubmissionRepository } from "./infrastructure/repositories/drizzle/drizzle-cadastro-submission.repository";
import { DrizzleVisitRepository } from "./infrastructure/repositories/drizzle/drizzle-visit.repository";
import { AvatarStorageAdapter } from "../access/infrastructure/avatar-storage/avatar-storage.adapter";
import { DrizzleTerritoryScopePort } from "./infrastructure/scope/drizzle-territory-scope.port";
import { DrizzleFacilityAssociationPort } from "./infrastructure/scope/drizzle-facility-association.port";
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
  GetFacilityProfessionalContextUseCase,
  ListFacilityProfessionalsUseCase,
  ManuallyAssociateProfessionalUseCase,
  UpdateFacilityProfessionalRoleUseCase,
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
  ApproveFacilityCadastroRecordUseCase,
  DownloadFacilityCadastroFileUseCase,
  GetFacilityCadastroChecklistUseCase,
  ListCadastroSubmissionsUseCase,
  RejectFacilityCadastroRecordUseCase,
  SubmitFacilityCadastroDocumentUseCase,
  UpdateFacilityBillingEmailUseCase,
} from "./application/use-cases/facility-cadastro.use-cases";
import {
  CompleteCadastroFileUploadUseCase,
  CreateCadastroSubmissionDocumentUseCase,
  DeleteDraftCadastroSubmissionUseCase,
  EnsureDraftCadastroSubmissionUseCase,
  GetCadastroFileSignedUrlUseCase,
  InitiateCadastroFileUploadUseCase,
  ListCadastroPackageSubmissionsUseCase,
  ListCadastroRequirementSubmissionsUseCase,
  ReorderCadastroDocumentFilesUseCase,
  ReviewCadastroDocumentUseCase,
  SignCadastroUploadPartsUseCase,
  SubmitCadastroRequirementUseCase,
  SubmitCadastroSubmissionUseCase,
} from "./application/use-cases/cadastro-submission.use-cases";
import { FacilityCadastroCompletionService } from "./application/services/facility-cadastro-completion.service";
import {
  ListFacilityVisitsUseCase,
  CreateFacilityVisitUseCase,
} from "./application/use-cases/visit.use-cases";
import {
  CreateFacilityRepresentativeUseCase,
  ListFacilityRepresentativesUseCase,
  UpdateFacilityRepresentativeUseCase,
} from "./application/use-cases/facility-representative.use-cases";
import {
  CreateFacilityNoteUseCase,
  ListFacilityNotesUseCase,
} from "./application/use-cases/facility-note.use-cases";
import {
  DownloadFacilityPhotoUseCase,
  ListFacilityPhotosUseCase,
  UploadFacilityPhotoUseCase,
} from "./application/use-cases/facility-photo.use-cases";
import {
  territoryMembershipService,
} from "../territory/composition";
import { geocodingPort } from "../maps/composition";
import { FacilityGeocodingService } from "./application/services/facility-geocoding.service";
import { PurchaseRecurrenceService } from "./application/services/purchase-recurrence.service";
import { DrizzleFacilityPurchaseRecurrenceRepository } from "./infrastructure/repositories/drizzle/facility-purchase-recurrence.repository";
import { searchService } from "../../infrastructure/search/search.service";
import { DrizzleRegistryReadRepository } from "../registry-ingestion/infrastructure/repositories/drizzle/drizzle-registry-read.repository";
import { professionalRepositories } from "../professional/composition";

const registryReadRepository = new DrizzleRegistryReadRepository();

export const facilityRepositories = {
  facility: new DrizzleFacilityRepository(),
  purchaseRecurrence: new DrizzleFacilityPurchaseRecurrenceRepository(),
  association: new DrizzleFacilityProfessionalRepository(),
  representative: new DrizzleFacilityRepresentativeRepository(),
  userRepresentativeRelationship:
    new DrizzleUserRepresentativeRelationshipRepository(),
  consultantAssignment: new DrizzleFacilityConsultantAssignmentRepository(),
  note: new DrizzleFacilityNoteRepository(),
  photo: new DrizzleFacilityPhotoRepository(),
  conformity: new DrizzleConformityRepository(),
  cadastroSubmission: new DrizzleCadastroSubmissionRepository(),
  visit: new DrizzleVisitRepository(),
};

const facilityPhotoStorage = new AvatarStorageAdapter();

const facilityCadastroCompletionService = new FacilityCadastroCompletionService({
  facilityRepository: facilityRepositories.facility,
  conformityRepository: facilityRepositories.conformity,
  cadastroRepository: facilityRepositories.cadastroSubmission,
});

const facilityCadastroDeps = {
  facilityRepository: facilityRepositories.facility,
  conformityRepository: facilityRepositories.conformity,
  storage: facilityPhotoStorage,
  completionService: facilityCadastroCompletionService,
  cadastroRepository: facilityRepositories.cadastroSubmission,
};

const cadastroSubmissionDeps = {
  facilityRepository: facilityRepositories.facility,
  conformityRepository: facilityRepositories.conformity,
  cadastroRepository: facilityRepositories.cadastroSubmission,
  completionService: facilityCadastroCompletionService,
};

export const facilityTerritoryScopePort = new DrizzleTerritoryScopePort(
  facilityRepositories.facility
);

export const facilityAssociationPort = new DrizzleFacilityAssociationPort(
  facilityRepositories.consultantAssignment,
);

export const facilityGeocodingService = new FacilityGeocodingService({
  facilityRepository: facilityRepositories.facility,
  geocodingPort,
});

async function handleFacilityLocationChanged(facilityId: string): Promise<void> {
  await facilityGeocodingService.ensureCoordinatesPersisted(facilityId);
  await territoryMembershipService.assignFacilityById(facilityId);
}

export const purchaseRecurrenceService = new PurchaseRecurrenceService(
  facilityRepositories.purchaseRecurrence,
);

const facilityMembershipDeps = {
  facilityRepository: facilityRepositories.facility,
  searchService,
  facilityGeocodingService,
  purchaseRecurrenceService,
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
      userProfessionalRelationshipRepository:
        professionalRepositories.userProfessionalRelationship,
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
  getFacilityProfessionalContext: () =>
    new GetFacilityProfessionalContextUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
      professionalRepository: professionalRepositories.professional,
      userProfessionalRelationshipRepository:
        professionalRepositories.userProfessionalRelationship,
    }),
  updateFacilityProfessionalRole: () =>
    new UpdateFacilityProfessionalRoleUseCase({
      facilityProfessionalRepository: facilityRepositories.association,
      userProfessionalRelationshipRepository:
        professionalRepositories.userProfessionalRelationship,
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
  listFacilityRepresentatives: () =>
    new ListFacilityRepresentativesUseCase({
      facilityRepresentativeRepository: facilityRepositories.representative,
      userRepresentativeRelationshipRepository:
        facilityRepositories.userRepresentativeRelationship,
    }),
  createFacilityRepresentative: () =>
    new CreateFacilityRepresentativeUseCase({
      facilityRepresentativeRepository: facilityRepositories.representative,
      userRepresentativeRelationshipRepository:
        facilityRepositories.userRepresentativeRelationship,
    }),
  updateFacilityRepresentative: () =>
    new UpdateFacilityRepresentativeUseCase({
      facilityRepresentativeRepository: facilityRepositories.representative,
      userRepresentativeRelationshipRepository:
        facilityRepositories.userRepresentativeRelationship,
    }),
  listFacilityNotes: () =>
    new ListFacilityNotesUseCase({
      facilityNoteRepository: facilityRepositories.note,
    }),
  createFacilityNote: () =>
    new CreateFacilityNoteUseCase({
      facilityNoteRepository: facilityRepositories.note,
    }),
  listFacilityPhotos: () =>
    new ListFacilityPhotosUseCase({
      facilityPhotoRepository: facilityRepositories.photo,
      facilityRepository: facilityRepositories.facility,
      storage: facilityPhotoStorage,
    }),
  uploadFacilityPhoto: () =>
    new UploadFacilityPhotoUseCase({
      facilityPhotoRepository: facilityRepositories.photo,
      facilityRepository: facilityRepositories.facility,
      storage: facilityPhotoStorage,
    }),
  downloadFacilityPhoto: () =>
    new DownloadFacilityPhotoUseCase({
      facilityPhotoRepository: facilityRepositories.photo,
      storage: facilityPhotoStorage,
    }),
  listConsultantAssignments: () =>
    new ListFacilityConsultantAssignmentsUseCase({
      consultantAssignmentRepository: facilityRepositories.consultantAssignment,
    }),
  assignConsultant: () =>
    new AssignFacilityConsultantUseCase({
      consultantAssignmentRepository: facilityRepositories.consultantAssignment,
      onConsultantAssignmentChanged: async (userIds) => {
        // Lazy import avoids access ↔ facility composition cycle at module load.
        const { accessScopeServices } = await import("../access/composition");
        await accessScopeServices.scope.invalidateForConsultantAssignmentChange(
          userIds,
        );
      },
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
  getFacilityCadastroChecklist: () =>
    new GetFacilityCadastroChecklistUseCase(facilityCadastroDeps),
  updateFacilityBillingEmail: () =>
    new UpdateFacilityBillingEmailUseCase(facilityCadastroDeps),
  submitFacilityCadastroDocument: () =>
    new SubmitFacilityCadastroDocumentUseCase(facilityCadastroDeps),
  downloadFacilityCadastroFile: () =>
    new DownloadFacilityCadastroFileUseCase({
      conformityRepository: facilityRepositories.conformity,
      storage: facilityPhotoStorage,
    }),
  approveFacilityCadastroRecord: () =>
    new ApproveFacilityCadastroRecordUseCase(facilityCadastroDeps),
  rejectFacilityCadastroRecord: () =>
    new RejectFacilityCadastroRecordUseCase(facilityCadastroDeps),
  listCadastroSubmissions: () =>
    new ListCadastroSubmissionsUseCase({
      conformityRepository: facilityRepositories.conformity,
      facilityRepository: facilityRepositories.facility,
      cadastroRepository: facilityRepositories.cadastroSubmission,
    }),
  ensureDraftCadastroSubmission: () =>
    new EnsureDraftCadastroSubmissionUseCase(cadastroSubmissionDeps),
  createCadastroSubmissionDocument: () =>
    new CreateCadastroSubmissionDocumentUseCase(cadastroSubmissionDeps),
  initiateCadastroFileUpload: () =>
    new InitiateCadastroFileUploadUseCase(cadastroSubmissionDeps),
  signCadastroUploadParts: () =>
    new SignCadastroUploadPartsUseCase(cadastroSubmissionDeps),
  completeCadastroFileUpload: () =>
    new CompleteCadastroFileUploadUseCase(cadastroSubmissionDeps),
  reorderCadastroDocumentFiles: () =>
    new ReorderCadastroDocumentFilesUseCase(cadastroSubmissionDeps),
  getCadastroFileSignedUrl: () =>
    new GetCadastroFileSignedUrlUseCase(cadastroSubmissionDeps),
  submitCadastroSubmission: () =>
    new SubmitCadastroSubmissionUseCase(cadastroSubmissionDeps),
  submitCadastroRequirement: () =>
    new SubmitCadastroRequirementUseCase(cadastroSubmissionDeps),
  listCadastroRequirementSubmissions: () =>
    new ListCadastroRequirementSubmissionsUseCase(cadastroSubmissionDeps),
  deleteDraftCadastroSubmission: () =>
    new DeleteDraftCadastroSubmissionUseCase(cadastroSubmissionDeps),
  reviewCadastroDocument: () =>
    new ReviewCadastroDocumentUseCase(cadastroSubmissionDeps),
  listCadastroPackageSubmissions: () =>
    new ListCadastroPackageSubmissionsUseCase(cadastroSubmissionDeps),
  listFacilityVisits: () =>
    new ListFacilityVisitsUseCase({
      visitRepository: facilityRepositories.visit,
    }),
  createFacilityVisit: () =>
    new CreateFacilityVisitUseCase({
      visitRepository: facilityRepositories.visit,
    }),
};

export { territoryMembershipService };
