import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import {
  ApproveSuggestionUseCase,
  ListSuggestionsUseCase,
  RejectSuggestionUseCase,
} from "./suggestion.use-cases";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { FacilityProfessionalRepository } from "../../../facility/application/interfaces/facility-professional.repository.interface";
import type { IngestionSuggestionRepository } from "../interfaces/ingestion.repository.interface";

describe("Suggestion use cases", () => {
  let suggestionRepository: IngestionSuggestionRepository;
  let facilityRepository: FacilityRepository;
  let facilityProfessionalRepository: FacilityProfessionalRepository;

  beforeEach(() => {
    suggestionRepository = {
      findById: mock(async () => ({
        id: "sug-1",
        ingestionRunId: "run-1",
        type: "FACILITY_REGISTRY_DEACTIVATED" as const,
        status: "PENDING" as const,
        facilityId: "clinic-1",
        professionalId: null,
        facilityProfessionalId: null,
        reason: "missing_from_source",
        payload: {},
        suggestedAt: new Date(),
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionNote: null,
      })),
      resolve: mock(async (params) => ({
        id: params.id,
        ingestionRunId: "run-1",
        type: "FACILITY_REGISTRY_DEACTIVATED" as const,
        status: params.status,
        facilityId: "clinic-1",
        professionalId: null,
        facilityProfessionalId: null,
        reason: "missing_from_source",
        payload: {},
        suggestedAt: new Date(),
        resolvedAt: new Date(),
        resolvedByUserId: params.resolvedByUserId,
        resolutionNote: params.resolutionNote ?? null,
      })),
      create: mock(async () => {
        throw new Error("not used");
      }),
      findPendingDuplicate: mock(async () => null),
      supersedePending: mock(async () => {}),
      findAll: mock(async () => ({ suggestions: [], total: 0 })),
    };

    facilityRepository = {
      softDelete: mock(async () => {}),
      reactivate: mock(async () => {
        throw new Error("not used");
      }),
    } as unknown as FacilityRepository;

    facilityProfessionalRepository = {
      endAssociationById: mock(async () => ({
        id: "assoc-1",
        professionalId: "doc-1",
        facilityId: "clinic-1",
        sourceActive: false,
        sourceFirstSeenAt: null,
        sourceLastSeenAt: null,
        confirmedAt: new Date(),
        confirmedByUserId: "user-1",
        endedAt: new Date(),
        endedByUserId: "admin-1",
        endReason: "suggestion_approved",
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      restoreSourceActive: mock(async () => ({
        id: "assoc-1",
        professionalId: "doc-1",
        facilityId: "clinic-1",
        sourceActive: true,
        sourceFirstSeenAt: null,
        sourceLastSeenAt: null,
        confirmedAt: new Date(),
        confirmedByUserId: "user-1",
        endedAt: null,
        endedByUserId: null,
        endReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    } as unknown as FacilityProfessionalRepository;
  });

  it("approve clinic removal soft deletes clinic", async () => {
    const useCase = new ApproveSuggestionUseCase({
      suggestionRepository,
      facilityRepository,
      facilityProfessionalRepository,
    });

    const result = await useCase.execute({
      suggestionId: "sug-1",
      userId: "admin-1",
      scope: createGlobalScopeContext(),
    });

    expect(result?.status).toBe("APPROVED");
    expect(facilityRepository.softDelete).toHaveBeenCalledWith("clinic-1");
  });

  it("reject facility-professional removal restores source link", async () => {
    suggestionRepository.findById = mock(async () => ({
      id: "sug-2",
      ingestionRunId: "run-1",
      type: "FACILITY_PROFESSIONAL_REMOVAL" as const,
      status: "PENDING" as const,
      facilityId: "clinic-1",
      professionalId: "doc-1",
      facilityProfessionalId: "assoc-1",
      reason: "missing_from_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
    }));

    suggestionRepository.resolve = mock(async (params) => ({
      id: "sug-2",
      ingestionRunId: "run-1",
      type: "FACILITY_PROFESSIONAL_REMOVAL" as const,
      status: params.status,
      facilityId: "clinic-1",
      professionalId: "doc-1",
      facilityProfessionalId: "assoc-1",
      reason: "missing_from_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: new Date(),
      resolvedByUserId: params.resolvedByUserId,
      resolutionNote: null,
    }));

    const useCase = new RejectSuggestionUseCase({
      suggestionRepository,
      facilityRepository,
      facilityProfessionalRepository,
    });

    const result = await useCase.execute({
      suggestionId: "sug-2",
      userId: "manager-1",
      scope: createGlobalScopeContext(),
    });

    expect(result?.status).toBe("REJECTED");
    expect(facilityProfessionalRepository.restoreSourceActive).toHaveBeenCalledWith("assoc-1");
  });

  it("approve facility-professional removal ends association by id", async () => {
    suggestionRepository.findById = mock(async () => ({
      id: "sug-3",
      ingestionRunId: "run-1",
      type: "FACILITY_PROFESSIONAL_REMOVAL" as const,
      status: "PENDING" as const,
      facilityId: "clinic-1",
      professionalId: "doc-1",
      facilityProfessionalId: "assoc-1",
      reason: "missing_from_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
    }));

    suggestionRepository.resolve = mock(async (params) => ({
      id: "sug-3",
      ingestionRunId: "run-1",
      type: "FACILITY_PROFESSIONAL_REMOVAL" as const,
      status: params.status,
      facilityId: "clinic-1",
      professionalId: "doc-1",
      facilityProfessionalId: "assoc-1",
      reason: "missing_from_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: new Date(),
      resolvedByUserId: params.resolvedByUserId,
      resolutionNote: null,
    }));

    const useCase = new ApproveSuggestionUseCase({
      suggestionRepository,
      facilityRepository,
      facilityProfessionalRepository,
    });

    const result = await useCase.execute({
      suggestionId: "sug-3",
      userId: "admin-1",
      scope: createGlobalScopeContext(),
    });

    expect(result?.status).toBe("APPROVED");
    expect(facilityProfessionalRepository.endAssociationById).toHaveBeenCalledWith({
      facilityProfessionalId: "assoc-1",
      endedByUserId: "admin-1",
      endReason: "suggestion_approved",
    });
  });

  it("approve clinic reactivation reactivates clinic", async () => {
    suggestionRepository.findById = mock(async () => ({
      id: "sug-4",
      ingestionRunId: "run-1",
      type: "FACILITY_REGISTRY_REACTIVATED" as const,
      status: "PENDING" as const,
      facilityId: "clinic-1",
      professionalId: null,
      facilityProfessionalId: null,
      reason: "reappeared_in_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
    }));

    suggestionRepository.resolve = mock(async (params) => ({
      id: "sug-4",
      ingestionRunId: "run-1",
      type: "FACILITY_REGISTRY_REACTIVATED" as const,
      status: params.status,
      facilityId: "clinic-1",
      professionalId: null,
      facilityProfessionalId: null,
      reason: "reappeared_in_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: new Date(),
      resolvedByUserId: params.resolvedByUserId,
      resolutionNote: null,
    }));

    facilityRepository.reactivate = mock(async () => ({
      id: "clinic-1",
      name: "Clinic",
      address: null,
      lat: null,
      lng: null,
      territoryId: null,
      territoryAssignmentStatus: "unassigned" as const,
      territoryAssignmentSource: "geo" as const,
      sourceProvider: null,
      externalSourceId: null,
      sourceContentHash: null,
      sourceFirstSeenAt: null,
      sourceLastSeenAt: null,
      sourcePresent: true,
      sourceTracked: true,
      manuallyEditedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }));

    const useCase = new ApproveSuggestionUseCase({
      suggestionRepository,
      facilityRepository,
      facilityProfessionalRepository,
    });

    const result = await useCase.execute({
      suggestionId: "sug-4",
      userId: "admin-1",
      scope: createGlobalScopeContext(),
    });

    expect(result?.status).toBe("APPROVED");
    expect(facilityRepository.reactivate).toHaveBeenCalledWith("clinic-1");
  });

  it("list suggestions uses deny-by-default facility scope when manager has no facilities", async () => {
    const scopedManager: ScopeContext = {
      isGlobal: false,
      roleName: "MANAGER",
      effectiveTerritoryIds: ["territory-1"],
      facilityIds: [],
      managedUserIds: ["user-1"],
    };

    const useCase = new ListSuggestionsUseCase({
      suggestionRepository,
    });

    await useCase.execute({
      scope: scopedManager,
      page: 1,
      limit: 20,
    });

    expect(suggestionRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityIds: ["__none__"],
      })
    );
  });
});
