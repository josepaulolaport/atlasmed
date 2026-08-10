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
    id: 1,
    name: "Clínica",
    legalDocumentType: "CPF",
    legalDocument: null,
    billingEmail: null,
    conformityStatus: "INCOMPLETE",
    commercialStatus: null,
    ...overrides,
  } as Awaited<ReturnType<FacilityRepository["findById"]>>;
}

function requirement(
  id: number,
  slug: string,
  appliesToLegalDocumentType: "CNPJ" | "CPF" | null
) {
  return {
    id,
    slug,
    name: slug,
    description: null,
    verticalId: null,
    appliesToLegalDocumentType,
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
  it("filters requirements by CPF legal document type", async () => {
    const findActiveRequirements = mock(async () => [
      requirement(1, "identidade", "CPF"),
      requirement(2, "crm", "CPF"),
      requirement(3, "comprovante_endereco", "CPF"),
    ]);

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CPF" }),
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
    }).execute({ facilityId: 1, scope: globalScope });

    expect(findActiveRequirements).toHaveBeenCalledWith({ legalDocumentType: "CPF" });
    expect(result.documents.map((d) => d.slug)).toEqual([
      "identidade",
      "crm",
      "comprovante_endereco",
    ]);
    expect(result.billing.uiStatus).toBe("missing");
    expect(result.counts.pendingAction).toBe(4);
  });

  it("filters requirements by CNPJ legal document type", async () => {
    const findActiveRequirements = mock(async () => [
      requirement(4, "carta_cnpj", "CNPJ"),
      requirement(5, "licenca_sanitaria", "CNPJ"),
    ]);

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CNPJ" }),
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
    }).execute({ facilityId: 1, scope: globalScope });

    expect(findActiveRequirements).toHaveBeenCalledWith({ legalDocumentType: "CNPJ" });
    expect(result.documents.map((d) => d.slug)).toEqual([
      "carta_cnpj",
      "licenca_sanitaria",
    ]);
    expect(result.documents.some((d) => d.slug === "identidade")).toBe(false);
  });

  it("orders CPF requirements Identidade → CRM → Comprovante", async () => {
    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CPF" }),
      } as unknown as FacilityRepository,
      conformityRepository: {
        // Deliberately unsorted
        findActiveRequirements: async () => [
          requirement(3, "comprovante_endereco", "CPF"),
          requirement(1, "identidade", "CPF"),
          requirement(2, "crm", "CPF"),
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
    }).execute({ facilityId: 1, scope: globalScope });

    expect(result.documents.map((d) => d.slug)).toEqual([
      "identidade",
      "crm",
      "comprovante_endereco",
    ]);
    expect(result.billing.name).toBe("Email Administrativo");
  });

  // D-08 regression (spec 0011 §1, §8.1). The checklist used to serialize files
  // only for an APPROVED document, so a freshly uploaded DRAFT came back with
  // `files: []`; the mobile compose screen matches poll results on
  // `files[].fileAssetId`, never matched, and "Enviar" stayed disabled forever.
  it("returns the DRAFT document's files and status in the checklist", async () => {
    const listDocumentFiles = mock(async (documentId: number) =>
      documentId === 100
        ? [
            {
              id: 1,
              submissionDocumentId: 100,
              fileAssetId: 501,
              position: 1,
              role: "PAGE",
              createdAt: now,
              fileAsset: {
                id: 501,
                originalFilename: "rg-frente.jpg",
                status: "READY",
                declaredMimeType: "image/jpeg",
                detectedMimeType: "image/jpeg",
              },
            },
          ]
        : []
    );

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CPF" }),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [requirement(1, "identidade", "CPF")],
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
      cadastroRepository: {
        findDraftByFacility: async () => ({
          id: 10,
          facilityId: 1,
          status: "DRAFT",
          version: 1,
          submittedAt: null,
        }),
        findLatestByFacility: async () => null,
        findDocumentsBySubmission: async () => [
          {
            id: 100,
            submissionId: 10,
            requirementId: 1,
            title: "Identidade",
            status: "DRAFT",
            version: 1,
            reviewComment: null,
          },
        ],
        // Nothing has been sent for review yet.
        listDocumentsForFacilityRequirement: async () => [],
        listDocumentFiles,
      } as never,
    }).execute({ facilityId: 1, scope: globalScope });

    const doc = result.documents[0]!;
    expect(doc.documentId).toBe(100);
    expect(doc.documentStatus).toBe("DRAFT");
    expect(doc.files).toEqual([
      {
        fileAssetId: 501,
        position: 1,
        role: "PAGE",
        fileName: "rg-frente.jpg",
        status: "READY",
        contentType: "image/jpeg",
      },
    ]);
    // The pill is still "Pendente": nothing has been submitted for review.
    expect(doc.uiStatus).toBe("missing");
  });

  it("keeps the approved document as the current one for the checklist", async () => {
    const listDocumentFiles = mock(async (documentId: number) =>
      documentId === 200
        ? [
            {
              id: 2,
              submissionDocumentId: 200,
              fileAssetId: 900,
              position: 1,
              role: "PAGE",
              createdAt: now,
              fileAsset: {
                id: 900,
                originalFilename: "aprovado.pdf",
                status: "READY",
                declaredMimeType: "application/pdf",
                detectedMimeType: "application/pdf",
              },
            },
          ]
        : []
    );

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CPF" }),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [requirement(1, "identidade", "CPF")],
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
      cadastroRepository: {
        findDraftByFacility: async () => ({
          id: 11,
          facilityId: 1,
          status: "DRAFT",
          version: 2,
          submittedAt: null,
        }),
        findLatestByFacility: async () => null,
        // A brand-new draft document replacing an already approved one.
        findDocumentsBySubmission: async () => [
          {
            id: 101,
            submissionId: 11,
            requirementId: 1,
            title: "Identidade",
            status: "DRAFT",
            version: 2,
            reviewComment: null,
          },
        ],
        listDocumentsForFacilityRequirement: async () => [
          {
            document: {
              id: 200,
              submissionId: 9,
              requirementId: 1,
              title: "Identidade",
              status: "APPROVED",
              version: 1,
              reviewComment: null,
            },
            submission: {
              id: 9,
              facilityId: 1,
              status: "APPROVED",
              version: 1,
              submittedAt: now,
            },
          },
        ],
        listDocumentFiles,
      } as never,
    }).execute({ facilityId: 1, scope: globalScope });

    const doc = result.documents[0]!;
    expect(doc.uiStatus).toBe("approved");
    expect(doc.documentId).toBe(200);
    expect(doc.documentStatus).toBe("APPROVED");
    expect(doc.files.map((f) => f.fileAssetId)).toEqual([900]);
  });
});

const verticalId = 1;

function verticalProfileRepositoryMocks(
  commercialStatus: "UNREGISTERED" | "REGISTERED" | "SUSPENDED" | null = null,
) {
  return {
    ensureVerticalProfile: mock(async () => {}),
    findVerticalProfilesByFacilityIds: mock(async () =>
      new Map([
        [
          1,
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
            legalDocumentType: "CNPJ",
            billingEmail: "fin@ex.com",
            conformityStatus: "INCOMPLETE",
          }),
        update,
        ...verticalProfileRepositoryMocks(),
        updateVerticalProfileCommercialStatus,
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [
          requirement(4, "carta_cnpj", "CNPJ"),
          requirement(5, "licenca_sanitaria", "CNPJ"),
        ],
        findRecordsByFacility: async () => [
          {
            id: 1,
            facilityId: 1,
            requirementId: 4,
            status: "VALIDATED",
            requirement: { id: 4, slug: "carta_cnpj", name: "Carta" },
          },
          {
            id: 2,
            facilityId: 1,
            requirementId: 5,
            status: "VALIDATED",
            requirement: { id: 5, slug: "licenca", name: "Licença" },
          },
        ],
      } as unknown as ConformityRepository,
    });

    const result = await service.evaluateAndApply(1, verticalId);
    expect(result.complete).toBe(true);
    expect(result.conformityStatus).toBe("COMPLETE");
    expect(result.commercialStatus).toBe("REGISTERED");
    expect(update).toHaveBeenCalledWith(1, {
      conformityStatus: "COMPLETE",
    });
    expect(updateVerticalProfileCommercialStatus).toHaveBeenCalledWith({
      facilityId: 1,
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
            legalDocumentType: "CNPJ",
            billingEmail: null,
            conformityStatus: "INCOMPLETE",
          }),
        update,
        ...verticalProfileRepositoryMocks(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [
          requirement(4, "carta_cnpj", "CNPJ"),
        ],
        findRecordsByFacility: async () => [
          {
            id: 1,
            facilityId: 1,
            requirementId: 4,
            status: "VALIDATED",
            requirement: { id: 4, slug: "carta_cnpj", name: "Carta" },
          },
        ],
      } as unknown as ConformityRepository,
    });

    const result = await service.evaluateAndApply(1, verticalId);
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
            legalDocumentType: "CNPJ",
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
          requirement(4, "carta_cnpj", "CNPJ"),
          requirement(5, "licenca_sanitaria", "CNPJ"),
        ],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      cadastroRepository: {
        listDocumentsForFacilityRequirement: async ({
          requirementId,
        }: {
          requirementId: number;
        }) =>
          requirementId === 4
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

    const result = await service.evaluateAndApply(1, verticalId);
    expect(result.complete).toBe(false);
    expect(result.conformityStatus).toBe("INCOMPLETE");
    expect(result.commercialStatus).toBe("SUSPENDED");
    expect(update).toHaveBeenCalledWith(1, {
      conformityStatus: "INCOMPLETE",
    });
    expect(updateVerticalProfileCommercialStatus).toHaveBeenCalledWith({
      facilityId: 1,
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
            legalDocumentType: "CNPJ",
            billingEmail: "fin@ex.com",
            conformityStatus: "INCOMPLETE",
          }),
        update,
        ...verticalProfileRepositoryMocks(),
        updateVerticalProfileCommercialStatus,
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [
          requirement(4, "carta_cnpj", "CNPJ"),
          requirement(5, "licenca_sanitaria", "CNPJ"),
        ],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      cadastroRepository: {
        listDocumentsForFacilityRequirement: async ({
          requirementId,
        }: {
          requirementId: number;
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

    const result = await service.evaluateAndApply(1, verticalId);
    expect(result.complete).toBe(true);
    expect(update).toHaveBeenCalledWith(1, {
      conformityStatus: "COMPLETE",
    });
    expect(updateVerticalProfileCommercialStatus).toHaveBeenCalledWith({
      facilityId: 1,
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
          id: 1,
          facilityId: 1,
          requirementId: 1,
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
            id: 1,
            slug: "identidade",
            name: "Identidade",
            description: null,
            appliesToLegalDocumentType: "CPF",
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
        facilityId: 1,
        recordId: 1,
        userId: 1,
        scope: globalScope,
        reviewerNote: "   ",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
