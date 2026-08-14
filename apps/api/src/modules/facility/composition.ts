import { DrizzleFacilityRepository } from "./infrastructure/repositories/drizzle/drizzle-facility.repository";
import { DrizzleFacilityVerticalRepAssignmentRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-vertical-rep-assignment.repository";
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
  ListClinicalFocusesUseCase,
  ListFacilityUnitTypesUseCase,
  ListUnitTypesUseCase,
  UpdateFacilityUseCase,
} from "./application/use-cases/facility.use-cases";
import { ListMapFacilityPointsUseCase } from "./application/use-cases/list-map-facility-points.use-case";
import {
  AssignFacilityVerticalRepUseCase,
  DeactivateFacilityVerticalUseCase,
  ListFacilityVerticalRepAssignmentsUseCase,
  ListOutOfTerritoryAssignmentsUseCase,
  UnassignFacilityVerticalRepUseCase,
} from "./application/use-cases/facility-vertical-rep.use-cases";
import {
  CreateFacilityConformityRecordUseCase,
  ListConformityRequirementsUseCase,
  ListFacilityConformityRecordsUseCase,
} from "./application/use-cases/conformity.use-cases";
import {
  ApproveFacilityCadastroRecordUseCase,
  GetFacilityCadastroChecklistUseCase,
  ListCadastroSubmissionsUseCase,
  RejectFacilityCadastroRecordUseCase,
  UpdateFacilityBillingEmailUseCase,
} from "./application/use-cases/facility-cadastro.use-cases";
import {
  CompleteCadastroFileUploadUseCase,
  CreateCadastroDocumentUseCase,
  DeleteCadastroDocumentUseCase,
  GetCadastroFileSignedUrlUseCase,
  InitiateCadastroFileUploadUseCase,
  ListCadastroRequirementSubmissionsUseCase,
  ReorderCadastroDocumentFilesUseCase,
  ReviewCadastroDocumentUseCase,
  SignCadastroUploadPartsUseCase,
  SubmitCadastroRequirementUseCase,
} from "./application/use-cases/cadastro-submission.use-cases";
import { FacilityCadastroCompletionService } from "./application/services/facility-cadastro-completion.service";
import {
  ListFacilityVisitsUseCase,
  CreateFacilityVisitUseCase,
} from "./application/use-cases/visit.use-cases";
import {
  CreateFacilityNoteUseCase,
  DeleteFacilityNoteUseCase,
  ListFacilityNotesUseCase,
  UpdateFacilityNoteUseCase,
} from "./application/use-cases/facility-note.use-cases";
import {
  DownloadFacilityPhotoUseCase,
  ListFacilityPhotosUseCase,
  UploadFacilityPhotoUseCase,
} from "./application/use-cases/facility-photo.use-cases";
import {
  territoryMembershipService,
  territoryRepositories,
} from "../territory/composition";
import { geocodingPort } from "../maps/composition";
import { FacilityGeocodingService } from "./application/services/facility-geocoding.service";
import { FacilityLocationService } from "./application/services/facility-location.service";
import { DrizzleFacilityLocationRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-location.repository";
import { PurchaseRecurrenceService } from "./application/services/purchase-recurrence.service";
import { DrizzleFacilityPurchaseRecurrenceRepository } from "./infrastructure/repositories/drizzle/facility-purchase-recurrence.repository";
import { DrizzleFacilityBookmarkRepository } from "./infrastructure/repositories/drizzle/drizzle-facility-bookmark.repository";
import {
  AddFacilityBookmarkUseCase,
  ListFacilityBookmarksUseCase,
  RemoveFacilityBookmarkUseCase,
} from "./application/use-cases/facility-bookmark.use-cases";
import { upsertFacilitySearchDocument } from "../../infrastructure/search/facility-search-index.service";
import { searchService } from "../../infrastructure/search/search.service";

export const facilityRepositories = {
  facility: new DrizzleFacilityRepository(),
  purchaseRecurrence: new DrizzleFacilityPurchaseRecurrenceRepository(),
  verticalRepAssignment: new DrizzleFacilityVerticalRepAssignmentRepository(),
  note: new DrizzleFacilityNoteRepository(),
  photo: new DrizzleFacilityPhotoRepository(),
  conformity: new DrizzleConformityRepository(),
  cadastroSubmission: new DrizzleCadastroSubmissionRepository(),
  visit: new DrizzleVisitRepository(),
  bookmark: new DrizzleFacilityBookmarkRepository(),
};

const facilityBookmarkDeps = {
  facilityBookmarkRepository: facilityRepositories.bookmark,
  facilityRepository: facilityRepositories.facility,
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
  facilityRepositories.verticalRepAssignment,
);

export const facilityGeocodingService = new FacilityGeocodingService({
  facilityRepository: facilityRepositories.facility,
  geocodingPort,
});

async function handleFacilityLocationChanged(facilityId: number): Promise<void> {
  await facilityGeocodingService.ensureCoordinatesPersisted(facilityId);
  await territoryMembershipService.assignFacilityById(facilityId);
}

/**
 * Spec 0009 R5: the single owner of every location write. Scripts included —
 * `geocode-facilities.ts` used to UPDATE the column directly, so the clinics it
 * moved never had their membership recomputed (D-18).
 */
export const facilityLocationService = new FacilityLocationService({
  locationRepository: new DrizzleFacilityLocationRepository(),
  geocodingService: facilityGeocodingService,
  coverage: territoryRepositories.spatial,
  onLocationChanged: async (facilityId) => {
    await territoryMembershipService.assignFacilityById(facilityId);
    await upsertFacilitySearchDocument(facilityId);
  },
});

async function handleFacilityChanged(facilityId: number): Promise<void> {
  await upsertFacilitySearchDocument(facilityId);
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
  onFacilityChanged: handleFacilityChanged,
  facilityBookmarkRepository: facilityRepositories.bookmark,
};

export const facilityUseCases = {
  listFacilities: () => new ListFacilitiesUseCase(facilityMembershipDeps),
  listMapFacilityPoints: () =>
    new ListMapFacilityPointsUseCase({
      facilityRepository: facilityRepositories.facility,
    }),
  listClinicalFocuses: () =>
    new ListClinicalFocusesUseCase(facilityMembershipDeps),
  listFacilityUnitTypes: () =>
    new ListFacilityUnitTypesUseCase(facilityMembershipDeps),
  listUnitTypes: () => new ListUnitTypesUseCase(facilityMembershipDeps),
  getFacility: () => new GetFacilityUseCase(facilityMembershipDeps),
  createFacility: () => new CreateFacilityUseCase(facilityMembershipDeps),
  updateFacility: () => new UpdateFacilityUseCase(facilityMembershipDeps),
  deleteFacility: () => new DeleteFacilityUseCase(facilityMembershipDeps),
  addFacilityBookmark: () => new AddFacilityBookmarkUseCase(facilityBookmarkDeps),
  removeFacilityBookmark: () =>
    new RemoveFacilityBookmarkUseCase(facilityBookmarkDeps),
  listFacilityBookmarks: () =>
    new ListFacilityBookmarksUseCase(facilityBookmarkDeps),
  listFacilityNotes: () =>
    new ListFacilityNotesUseCase({
      facilityNoteRepository: facilityRepositories.note,
    }),
  createFacilityNote: () =>
    new CreateFacilityNoteUseCase({
      facilityNoteRepository: facilityRepositories.note,
    }),
  updateFacilityNote: () =>
    new UpdateFacilityNoteUseCase({
      facilityNoteRepository: facilityRepositories.note,
    }),
  deleteFacilityNote: () =>
    new DeleteFacilityNoteUseCase({
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
  listVerticalRepAssignments: () =>
    new ListFacilityVerticalRepAssignmentsUseCase({
      repAssignmentRepository: facilityRepositories.verticalRepAssignment,
    }),
  // Spec 0009 R2: overrides are reportable, or they are just an untracked hole.
  listOutOfTerritoryAssignments: () =>
    new ListOutOfTerritoryAssignmentsUseCase({
      repAssignmentRepository: facilityRepositories.verticalRepAssignment,
    }),
  assignVerticalRep: () =>
    new AssignFacilityVerticalRepUseCase({
      repAssignmentRepository: facilityRepositories.verticalRepAssignment,
      assertVerticalActive: async (verticalId) => {
        const { businessVerticals } = await import("@atlasmed/database");
        const { eq } = await import("drizzle-orm");
        const { db } = await import("../../infrastructure/database/db");
        const { ValidationError } = await import("../../shared/errors");
        const [row] = await db
          .select({ id: businessVerticals.id, isActive: businessVerticals.isActive })
          .from(businessVerticals)
          .where(eq(businessVerticals.id, verticalId))
          .limit(1);
        if (!row || !row.isActive) {
          throw new ValidationError([
            { field: "verticalId", message: "vertical is inactive or missing" },
          ]);
        }
      },
      assertAssigneeHasVertical: async ({ userId, verticalId }) => {
        const { userVerticalAssignments } = await import("@atlasmed/database");
        const { and, eq } = await import("drizzle-orm");
        const { db } = await import("../../infrastructure/database/db");
        const { ValidationError } = await import("../../shared/errors");
        const [row] = await db
          .select({ id: userVerticalAssignments.id })
          .from(userVerticalAssignments)
          .where(
            and(
              eq(userVerticalAssignments.userId, userId),
              eq(userVerticalAssignments.verticalId, verticalId),
            ),
          )
          .limit(1);
        if (!row) {
          throw new ValidationError([
            {
              field: "userId",
              message: "assignee must have user_vertical_assignments for this vertical",
            },
          ]);
        }
      },
      assertAssigneeCoversFacility: async ({ userId, facilityId }) => {
        const { territoryRepositories } = await import("../territory/composition");
        const { OperationNotAllowedError } = await import("../../shared/errors");
        const covers =
          await territoryRepositories.spatial.userHasRepPatchCoveringFacility(
            userId,
            facilityId,
          );
        if (!covers) {
          throw new OperationNotAllowedError(
            "assign_vertical_rep",
            "Representative must have a territory patch covering this clinic",
          );
        }
      },
      onRepAssignmentChanged: async (userIds) => {
        const { accessScopeServices } = await import("../access/composition");
        await accessScopeServices.scope.invalidateForConsultantAssignmentChange(
          userIds,
        );
      },
      onFacilityChanged: handleFacilityChanged,
    }),
  unassignVerticalRep: () =>
    new UnassignFacilityVerticalRepUseCase({
      repAssignmentRepository: facilityRepositories.verticalRepAssignment,
      onRepAssignmentChanged: async (userIds) => {
        const { accessScopeServices } = await import("../access/composition");
        await accessScopeServices.scope.invalidateForConsultantAssignmentChange(
          userIds,
        );
      },
      onFacilityChanged: handleFacilityChanged,
    }),
  deactivateFacilityVertical: () =>
    new DeactivateFacilityVerticalUseCase({
      repAssignmentRepository: facilityRepositories.verticalRepAssignment,
      onRepAssignmentChanged: async (userIds) => {
        const { accessScopeServices } = await import("../access/composition");
        await accessScopeServices.scope.invalidateForConsultantAssignmentChange(
          userIds,
        );
      },
      onFacilityChanged: handleFacilityChanged,
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
  createCadastroDocument: () =>
    new CreateCadastroDocumentUseCase(cadastroSubmissionDeps),
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
  submitCadastroRequirement: () =>
    new SubmitCadastroRequirementUseCase(cadastroSubmissionDeps),
  listCadastroRequirementSubmissions: () =>
    new ListCadastroRequirementSubmissionsUseCase(cadastroSubmissionDeps),
  deleteCadastroDocument: () =>
    new DeleteCadastroDocumentUseCase(cadastroSubmissionDeps),
  reviewCadastroDocument: () =>
    new ReviewCadastroDocumentUseCase(cadastroSubmissionDeps),
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
