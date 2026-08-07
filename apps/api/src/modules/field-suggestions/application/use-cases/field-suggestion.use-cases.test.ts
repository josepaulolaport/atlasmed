import { describe, expect, it, mock } from "bun:test";
import { createGlobalScopeContext } from "@atlasmed/access";
import {
  CreateFacilityFieldSuggestionUseCase,
  ApproveFieldSuggestionUseCase,
} from "./field-suggestion.use-cases";
import type { FieldSuggestionRepository } from "../interfaces/field-suggestion.repository.interface";
import type { FacilityRepository } from "../../../facility/application/interfaces/facility.repository.interface";
import type { FieldSuggestionApplyService } from "../services/field-suggestion-apply.service";
import {
  OperationNotAllowedError,
  ValidationError,
} from "../../../../shared/errors";

const globalScope = createGlobalScopeContext();

function facilityStub() {
  return {
    id: 1,
    name: "Clinic",
    neighborhood: null,
    city: "São Paulo",
    state: "SP",
    streetAddress: "Av. Paulista",
    streetNumber: "1000",
    addressComplement: null,
    postalCode: null,
    stateId: 1,
    municipalityId: 1,
    phone: "1100000000",
    whatsapp: null,
    email: null,
    website: null,
    responsibleName: null,
    openingHours: null,
    legalDocumentType: "CNPJ",
    legalDocument: null,
    lat: null,
    lng: null,
    territoryId: null,
    territoryName: null,
    territoryAssignmentStatus: "unassigned" as const,
    commercialStatus: null,
    purchaseStatus: null,
    conformityStatus: "INCOMPLETE" as const,
    consultantName: null,
    consultantSince: null,
    managerName: null,
    imageUrl: null,
    cnesCode: null,
    facilityTypeCode: null,
    unitTypeCode: null,
    unitSubtypeCode: null,
    deactivatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    clinicalFocuses: [],
  };
}

describe("CreateFacilityFieldSuggestionUseCase", () => {
  it("rejects unknown field keys including commercialStatus", async () => {
    const facilityRepository = {
      findById: mock(async () => facilityStub()),
    } as unknown as FacilityRepository;

    const useCase = new CreateFacilityFieldSuggestionUseCase({
      facilityRepository,
      fieldSuggestionRepository: {} as FieldSuggestionRepository,
      applyService: {
        validateProposedValue: mock(() => {
          throw new Error("should not validate");
        }),
      } as unknown as FieldSuggestionApplyService,
    });

    await expect(
      useCase.execute({
        facilityId: 1,
        userId: 1,
        scope: globalScope,
        kind: "FIELD_CHANGE",
        fieldKey: "commercialStatus",
        proposedValue: "ACTIVE",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("supersedes via repository and returns serialized suggestion", async () => {
    const createdAt = new Date("2026-07-22T12:00:00.000Z");
    const fieldSuggestionRepository = {
      createWithSupersede: mock(async (input: { id: number }) => ({
        suggestion: {
          id: input.id,
          kind: "FIELD_CHANGE" as const,
          status: "PENDING" as const,
          facilityId: 1,
          facilityName: "Clinic",
          personId: null,
          fieldKey: "phoneNumber",
          currentValue: "1100000000",
          proposedValue: "11999990000",
          reason: null,
          submittedByUserId: 1,
          submittedByName: "Rep",
          submittedByRole: "REP",
          submittedAt: createdAt,
          resolvedAt: null,
          resolvedByUserId: null,
          resolvedByName: null,
          resolutionNote: null,
          createdAt,
          updatedAt: createdAt,
        },
        supersededIds: [99],
      })),
    } as unknown as FieldSuggestionRepository;

    const useCase = new CreateFacilityFieldSuggestionUseCase({
      facilityRepository: {
        findById: mock(async () => facilityStub()),
      } as unknown as FacilityRepository,
      fieldSuggestionRepository,
      applyService: {
        validateProposedValue: mock((_k: string, v: unknown) => v),
      } as unknown as FieldSuggestionApplyService,
    });

    const result = await useCase.execute({
      facilityId: 1,
      userId: 1,
      scope: globalScope,
      kind: "FIELD_CHANGE",
      fieldKey: "phoneNumber",
      proposedValue: "11999990000",
    });

    expect(result?.fieldKey).toBe("phoneNumber");
    expect(result?.status).toBe("PENDING");
    expect(fieldSuggestionRepository.createWithSupersede).toHaveBeenCalled();
  });
});

describe("ApproveFieldSuggestionUseCase", () => {
  it("rejects non-pending suggestions", async () => {
    const useCase = new ApproveFieldSuggestionUseCase({
      facilityRepository: {} as FacilityRepository,
      fieldSuggestionRepository: {
        findById: mock(async () => ({
          id: 1,
          status: "APPROVED",
          facilityId: 1,
        })),
      } as unknown as FieldSuggestionRepository,
      applyService: {} as FieldSuggestionApplyService,
    });

    await expect(
      useCase.execute({
        suggestionId: 1,
        userId: 2,
        scope: globalScope,
      })
    ).rejects.toBeInstanceOf(OperationNotAllowedError);
  });
});
