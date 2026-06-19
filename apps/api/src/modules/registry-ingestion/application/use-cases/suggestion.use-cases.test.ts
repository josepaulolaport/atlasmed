import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import {
  ApproveSuggestionUseCase,
  RejectSuggestionUseCase,
} from "./suggestion.use-cases";
import type { ClinicRepository } from "../../../clinic/application/interfaces/clinic.repository.interface";
import type { DoctorClinicAssociationRepository } from "../../../clinic/application/interfaces/doctor-clinic-association.repository.interface";
import type { IngestionSuggestionRepository } from "../interfaces/ingestion.repository.interface";

describe("Suggestion use cases", () => {
  let suggestionRepository: IngestionSuggestionRepository;
  let clinicRepository: ClinicRepository;
  let associationRepository: DoctorClinicAssociationRepository;

  beforeEach(() => {
    suggestionRepository = {
      findById: mock(async () => ({
        id: "sug-1",
        ingestionRunId: "run-1",
        type: "CLINIC_REMOVAL" as const,
        status: "PENDING" as const,
        clinicId: "clinic-1",
        doctorId: null,
        associationId: null,
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
        type: "CLINIC_REMOVAL" as const,
        status: params.status,
        clinicId: "clinic-1",
        doctorId: null,
        associationId: null,
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

    clinicRepository = {
      softDelete: mock(async () => {}),
      reactivate: mock(async () => {
        throw new Error("not used");
      }),
    } as unknown as ClinicRepository;

    associationRepository = {
      endAssociationById: mock(async () => ({
        id: "assoc-1",
        doctorId: "doc-1",
        clinicId: "clinic-1",
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
        doctorId: "doc-1",
        clinicId: "clinic-1",
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
    } as unknown as DoctorClinicAssociationRepository;
  });

  it("approve clinic removal soft deletes clinic", async () => {
    const useCase = new ApproveSuggestionUseCase({
      suggestionRepository,
      clinicRepository,
      associationRepository,
    });

    const result = await useCase.execute({
      suggestionId: "sug-1",
      userId: "admin-1",
      scope: createGlobalScopeContext(),
    });

    expect(result?.status).toBe("APPROVED");
    expect(clinicRepository.softDelete).toHaveBeenCalledWith("clinic-1");
  });

  it("reject doctor-clinic removal restores source link", async () => {
    suggestionRepository.findById = mock(async () => ({
      id: "sug-2",
      ingestionRunId: "run-1",
      type: "DOCTOR_CLINIC_REMOVAL" as const,
      status: "PENDING" as const,
      clinicId: "clinic-1",
      doctorId: "doc-1",
      associationId: "assoc-1",
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
      type: "DOCTOR_CLINIC_REMOVAL" as const,
      status: params.status,
      clinicId: "clinic-1",
      doctorId: "doc-1",
      associationId: "assoc-1",
      reason: "missing_from_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: new Date(),
      resolvedByUserId: params.resolvedByUserId,
      resolutionNote: null,
    }));

    const useCase = new RejectSuggestionUseCase({
      suggestionRepository,
      clinicRepository,
      associationRepository,
    });

    const result = await useCase.execute({
      suggestionId: "sug-2",
      userId: "manager-1",
      scope: createGlobalScopeContext(),
    });

    expect(result?.status).toBe("REJECTED");
    expect(associationRepository.restoreSourceActive).toHaveBeenCalledWith("assoc-1");
  });

  it("approve doctor-clinic removal ends association by id", async () => {
    suggestionRepository.findById = mock(async () => ({
      id: "sug-3",
      ingestionRunId: "run-1",
      type: "DOCTOR_CLINIC_REMOVAL" as const,
      status: "PENDING" as const,
      clinicId: "clinic-1",
      doctorId: "doc-1",
      associationId: "assoc-1",
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
      type: "DOCTOR_CLINIC_REMOVAL" as const,
      status: params.status,
      clinicId: "clinic-1",
      doctorId: "doc-1",
      associationId: "assoc-1",
      reason: "missing_from_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: new Date(),
      resolvedByUserId: params.resolvedByUserId,
      resolutionNote: null,
    }));

    const useCase = new ApproveSuggestionUseCase({
      suggestionRepository,
      clinicRepository,
      associationRepository,
    });

    const result = await useCase.execute({
      suggestionId: "sug-3",
      userId: "admin-1",
      scope: createGlobalScopeContext(),
    });

    expect(result?.status).toBe("APPROVED");
    expect(associationRepository.endAssociationById).toHaveBeenCalledWith({
      associationId: "assoc-1",
      endedByUserId: "admin-1",
      endReason: "suggestion_approved",
    });
  });

  it("approve clinic reactivation reactivates clinic", async () => {
    suggestionRepository.findById = mock(async () => ({
      id: "sug-4",
      ingestionRunId: "run-1",
      type: "CLINIC_REACTIVATION" as const,
      status: "PENDING" as const,
      clinicId: "clinic-1",
      doctorId: null,
      associationId: null,
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
      type: "CLINIC_REACTIVATION" as const,
      status: params.status,
      clinicId: "clinic-1",
      doctorId: null,
      associationId: null,
      reason: "reappeared_in_source",
      payload: {},
      suggestedAt: new Date(),
      resolvedAt: new Date(),
      resolvedByUserId: params.resolvedByUserId,
      resolutionNote: null,
    }));

    clinicRepository.reactivate = mock(async (id: string) => ({
      id,
      name: "Clinic",
      address: null,
      territoryId: null,
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
      clinicRepository,
      associationRepository,
    });

    const result = await useCase.execute({
      suggestionId: "sug-4",
      userId: "admin-1",
      scope: createGlobalScopeContext(),
    });

    expect(result?.status).toBe("APPROVED");
    expect(clinicRepository.reactivate).toHaveBeenCalledWith("clinic-1");
  });
});
