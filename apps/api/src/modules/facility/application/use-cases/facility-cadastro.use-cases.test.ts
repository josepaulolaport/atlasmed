import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { FacilityCadastroCompletionService } from "../services/facility-cadastro-completion.service";
import {
  GetFacilityCadastroChecklistUseCase,
  RejectFacilityCadastroRecordUseCase,
} from "./facility-cadastro.use-cases";

const now = new Date("2026-07-22T12:00:00.000Z");

const globalScope: ScopeContext = {
  isGlobal: true,
  assignedTerritoryIds: [],
  effectiveTerritoryIds: [],
  analyticsEffectiveTerritoryIds: [],
  territoryIds: [],
  facilityIds: [],
  analyticsFacilityIds: [],
  clinicIds: [],
  analyticsClinicIds: [],
  managedUserIds: [],
  isOperationallyActive: true,
};

function facility(overrides: Record<string, unknown> = {}) {
  return {
    id: "facility-1",
    name: "Clínica",
    taxIdType: "PF",
    billingEmail: null,
    conformityStatus: "INCOMPLETE",
    commercialStatus: null,
    ...overrides,
  } as Awaited<ReturnType<FacilityRepository["findById"]>>;
}

function requirement(
  id: string,
  slug: string,
  appliesToTaxIdType: "PF" | "PJ" | null
) {
  return {
    id,
    slug,
    name: slug,
    description: null,
    verticalId: null,
    appliesToTaxIdType,
    isActive: true,
    allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    maxFiles: 10,
    maxFileSizeBytes: 52_428_800,
    maxCombinedSizeBytes: 209_715_200,
    requiresFrontAndBack: slug === "identidade",
    createdAt: now,
    updatedAt: now,
  };
}

describe("GetFacilityCadastroChecklistUseCase", () => {
  it("filters requirements by PF tax id type", async () => {
    const findActiveRequirements = mock(async () => [
      requirement("r1", "identidade", "PF"),
      requirement("r2", "crm", "PF"),
      requirement("r3", "comprovante_endereco", "PF"),
    ]);

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ taxIdType: "PF" }),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements,
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      storage: {
        upload: async () => undefined,
        delete: async () => undefined,
        download: async () => new Uint8Array(),
      },
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
          conformityStatus: "INCOMPLETE",
          commercialStatus: null,
        }),
      } as unknown as FacilityCadastroCompletionService,
    }).execute({ facilityId: "facility-1", scope: globalScope });

    expect(findActiveRequirements).toHaveBeenCalledWith({ taxIdType: "PF" });
    expect(result.documents.map((d) => d.slug)).toEqual([
      "identidade",
      "crm",
      "comprovante_endereco",
    ]);
    expect(result.billing.uiStatus).toBe("missing");
    expect(result.counts.pendingAction).toBe(4);
  });

  it("filters requirements by PJ tax id type", async () => {
    const findActiveRequirements = mock(async () => [
      requirement("r4", "carta_cnpj", "PJ"),
      requirement("r5", "licenca_sanitaria", "PJ"),
    ]);

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ taxIdType: "PJ" }),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements,
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      storage: {
        upload: async () => undefined,
        delete: async () => undefined,
        download: async () => new Uint8Array(),
      },
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
          conformityStatus: "INCOMPLETE",
          commercialStatus: null,
        }),
      } as unknown as FacilityCadastroCompletionService,
    }).execute({ facilityId: "facility-1", scope: globalScope });

    expect(findActiveRequirements).toHaveBeenCalledWith({ taxIdType: "PJ" });
    expect(result.documents.map((d) => d.slug)).toEqual([
      "carta_cnpj",
      "licenca_sanitaria",
    ]);
    expect(result.documents.some((d) => d.slug === "identidade")).toBe(false);
  });

  it("orders PF requirements Identidade → CRM → Comprovante", async () => {
    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ taxIdType: "PF" }),
      } as unknown as FacilityRepository,
      conformityRepository: {
        // Deliberately unsorted
        findActiveRequirements: async () => [
          requirement("r3", "comprovante_endereco", "PF"),
          requirement("r1", "identidade", "PF"),
          requirement("r2", "crm", "PF"),
        ],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      storage: {
        upload: async () => undefined,
        delete: async () => undefined,
        download: async () => new Uint8Array(),
      },
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
          conformityStatus: "INCOMPLETE",
          commercialStatus: null,
        }),
      } as unknown as FacilityCadastroCompletionService,
    }).execute({ facilityId: "facility-1", scope: globalScope });

    expect(result.documents.map((d) => d.slug)).toEqual([
      "identidade",
      "crm",
      "comprovante_endereco",
    ]);
    expect(result.billing.name).toBe("Email Administrativo");
  });
});

const verticalId = "vertical-1";

function verticalProfileRepositoryMocks(
  commercialStatus: "UNREGISTERED" | "REGISTERED" | "SUSPENDED" | null = null,
) {
  return {
    ensureVerticalProfile: mock(async () => {}),
    findVerticalProfilesByFacilityIds: mock(async () =>
      new Map([
        [
          "facility-1",
          [{ verticalId, commercialStatus, isActive: true }],
        ],
      ]),
    ),
    updateVerticalProfileCommercialStatus: mock(async () => {}),
  };
}

describe("FacilityCadastroCompletionService", () => {
  it("flips statuses only when all docs validated and billing email set", async () => {
    const update = mock(async () => facility());
    const updateVerticalProfileCommercialStatus = mock(async () => {});
    const service = new FacilityCadastroCompletionService({
      facilityRepository: {
        findById: async () =>
          facility({
            taxIdType: "PJ",
            billingEmail: "fin@ex.com",
            conformityStatus: "INCOMPLETE",
          }),
        update,
        ...verticalProfileRepositoryMocks(),
        updateVerticalProfileCommercialStatus,
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [
          requirement("r4", "carta_cnpj", "PJ"),
          requirement("r5", "licenca_sanitaria", "PJ"),
        ],
        findRecordsByFacility: async () => [
          {
            id: "rec-1",
            facilityId: "facility-1",
            requirementId: "r4",
            status: "VALIDATED",
            requirement: { id: "r4", slug: "carta_cnpj", name: "Carta" },
          },
          {
            id: "rec-2",
            facilityId: "facility-1",
            requirementId: "r5",
            status: "VALIDATED",
            requirement: { id: "r5", slug: "licenca", name: "Licença" },
          },
        ],
      } as unknown as ConformityRepository,
    });

    const result = await service.evaluateAndApply("facility-1", verticalId);
    expect(result.complete).toBe(true);
    expect(result.conformityStatus).toBe("COMPLETE");
    expect(result.commercialStatus).toBe("REGISTERED");
    expect(update).toHaveBeenCalledWith("facility-1", {
      conformityStatus: "COMPLETE",
    });
    expect(updateVerticalProfileCommercialStatus).toHaveBeenCalledWith({
      facilityId: "facility-1",
      verticalId,
      commercialStatus: "REGISTERED",
    });
  });

  it("does not activate commercial when email is missing", async () => {
    const update = mock(async () => facility());
    const service = new FacilityCadastroCompletionService({
      facilityRepository: {
        findById: async () =>
          facility({
            taxIdType: "PJ",
            billingEmail: null,
            conformityStatus: "INCOMPLETE",
          }),
        update,
        ...verticalProfileRepositoryMocks(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [
          requirement("r4", "carta_cnpj", "PJ"),
        ],
        findRecordsByFacility: async () => [
          {
            id: "rec-1",
            facilityId: "facility-1",
            requirementId: "r4",
            status: "VALIDATED",
            requirement: { id: "r4", slug: "carta_cnpj", name: "Carta" },
          },
        ],
      } as unknown as ConformityRepository,
    });

    const result = await service.evaluateAndApply("facility-1", verticalId);
    expect(result.complete).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("forces commercial off REGISTERED when completion regresses", async () => {
    const update = mock(async () => facility());
    const updateVerticalProfileCommercialStatus = mock(async () => {});
    const service = new FacilityCadastroCompletionService({
      facilityRepository: {
        findById: async () =>
          facility({
            taxIdType: "PJ",
            billingEmail: "fin@ex.com",
            conformityStatus: "COMPLETE",
            commercialStatus: "REGISTERED",
          }),
        update,
        ...verticalProfileRepositoryMocks("REGISTERED"),
        updateVerticalProfileCommercialStatus,
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [
          requirement("r4", "carta_cnpj", "PJ"),
          requirement("r5", "licenca_sanitaria", "PJ"),
        ],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      cadastroRepository: {
        listDocumentsForFacilityRequirement: async ({
          requirementId,
        }: {
          requirementId: string;
        }) =>
          requirementId === "r4"
            ? [
                {
                  document: {
                    id: "doc-r4",
                    requirementId,
                    status: "APPROVED",
                  },
                  submission: { id: "sub-r4", status: "APPROVED" },
                },
              ]
            : [
                {
                  document: {
                    id: "doc-r5",
                    requirementId,
                    status: "REJECTED",
                  },
                  submission: { id: "sub-r5", status: "REJECTED" },
                },
              ],
      } as never,
    });

    const result = await service.evaluateAndApply("facility-1", verticalId);
    expect(result.complete).toBe(false);
    expect(result.conformityStatus).toBe("INCOMPLETE");
    expect(result.commercialStatus).toBe("SUSPENDED");
    expect(update).toHaveBeenCalledWith("facility-1", {
      conformityStatus: "INCOMPLETE",
    });
    expect(updateVerticalProfileCommercialStatus).toHaveBeenCalledWith({
      facilityId: "facility-1",
      verticalId,
      commercialStatus: "SUSPENDED",
    });
  });

  it("treats per-requirement APPROVED docs across packages as complete", async () => {
    const update = mock(async () => facility());
    const updateVerticalProfileCommercialStatus = mock(async () => {});
    const service = new FacilityCadastroCompletionService({
      facilityRepository: {
        findById: async () =>
          facility({
            taxIdType: "PJ",
            billingEmail: "fin@ex.com",
            conformityStatus: "INCOMPLETE",
          }),
        update,
        ...verticalProfileRepositoryMocks(),
        updateVerticalProfileCommercialStatus,
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [
          requirement("r4", "carta_cnpj", "PJ"),
          requirement("r5", "licenca_sanitaria", "PJ"),
        ],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      cadastroRepository: {
        listDocumentsForFacilityRequirement: async ({
          requirementId,
        }: {
          requirementId: string;
        }) => [
          {
            document: {
              id: `doc-${requirementId}`,
              requirementId,
              status: "APPROVED",
            },
            submission: { id: `sub-${requirementId}`, status: "APPROVED" },
          },
        ],
      } as never,
    });

    const result = await service.evaluateAndApply("facility-1", verticalId);
    expect(result.complete).toBe(true);
    expect(update).toHaveBeenCalledWith("facility-1", {
      conformityStatus: "COMPLETE",
    });
    expect(updateVerticalProfileCommercialStatus).toHaveBeenCalledWith({
      facilityId: "facility-1",
      verticalId,
      commercialStatus: "REGISTERED",
    });
  });
});

describe("RejectFacilityCadastroRecordUseCase", () => {
  it("requires reviewer note", async () => {
    const useCase = new RejectFacilityCadastroRecordUseCase({
      facilityRepository: {
        findById: async () => facility(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findRecordById: async () => ({
          id: "rec-1",
          facilityId: "facility-1",
          requirementId: "r1",
          status: "SUBMITTED",
          submittedAt: now,
          validatedAt: null,
          expiresAt: null,
          validatedByUserId: null,
          storageKey: null,
          url: null,
          contentType: null,
          fileName: null,
          reviewerNote: null,
          createdAt: now,
          updatedAt: now,
          requirement: {
            id: "r1",
            slug: "identidade",
            name: "Identidade",
            description: null,
            appliesToTaxIdType: "PF",
          },
        }),
        rejectRecord: async () => {
          throw new Error("should not reject");
        },
      } as unknown as ConformityRepository,
      storage: {
        upload: async () => undefined,
        delete: async () => undefined,
        download: async () => new Uint8Array(),
      },
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
          conformityStatus: "INCOMPLETE",
          commercialStatus: null,
        }),
      } as unknown as FacilityCadastroCompletionService,
    });

    await expect(
      useCase.execute({
        facilityId: "facility-1",
        recordId: "rec-1",
        userId: "ops-1",
        scope: globalScope,
        reviewerNote: "   ",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
