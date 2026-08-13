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
        findVerticalProfilesByFacilityIds: async () => new Map(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements,
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
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
        findVerticalProfilesByFacilityIds: async () => new Map(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements,
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
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
        findVerticalProfilesByFacilityIds: async () => new Map(),
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
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
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
    const files = [
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
    ];
    // Filters by the ids it is handed, so asking for the wrong document shows
    // up as missing files rather than passing on a fake that ignores its input.
    const listDocumentFilesForDocuments = mock(async (ids: number[]) =>
      files.filter((f) => ids.includes(f.submissionDocumentId))
    );

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CPF" }),
        findVerticalProfilesByFacilityIds: async () => new Map(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [requirement(1, "identidade", "CPF")],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
          commercialStatus: null,
        }),
      } as unknown as FacilityCadastroCompletionService,
      cadastroRepository: {
        // One DRAFT and nothing else: DRAFT is an open status so it is the
        // working document, and it is absent from the submitted set so the
        // history stays empty — no separate "nothing reviewed yet" fake needed.
        listDocumentsByFacility: async () => [
          {
            id: 100,
            facilityId: 1,
            facilityVerticalProfileId: null,
            requirementId: 1,
            title: "Identidade",
            status: "DRAFT",
            version: 1,
            reviewComment: null,
            submittedAt: null,
          },
        ],
        listDocumentFilesForDocuments,
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
    // Nothing approved yet, so the detail card has no approved version to show.
    expect(doc.currentApproved).toBeUndefined();
    // The pill is still "Pendente": nothing has been submitted for review.
    expect(doc.uiStatus).toBe("missing");
  });

  // Re-upload over an already-approved requirement — the "Enviar novo" flow,
  // which is the steady state once a clinic's cadastro is complete.
  //
  // The two fields describe two different documents on purpose: the top level
  // is the WORKING document (the draft the compose screen uploads into and
  // polls), `currentApproved` is the APPROVED one the detail screen renders
  // under "Versão aprovada vN". Serving the approved document at the top level
  // — as this test used to assert — left the compose screen's poll with
  // nothing to match, so "Enviar" never enabled on a re-upload.
  it("returns the draft as the working document over an approved one", async () => {
    const allFiles = [
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
      {
        id: 3,
        submissionDocumentId: 101,
        fileAssetId: 901,
        position: 1,
        role: "PAGE",
        createdAt: now,
        fileAsset: {
          id: 901,
          originalFilename: "renovacao.pdf",
          status: "READY",
          declaredMimeType: "application/pdf",
          detectedMimeType: "application/pdf",
        },
      },
    ];
    const listDocumentFilesForDocuments = mock(async (ids: number[]) =>
      allFiles.filter((f) => ids.includes(f.submissionDocumentId))
    );

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CPF" }),
        findVerticalProfilesByFacilityIds: async () => new Map(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [requirement(1, "identidade", "CPF")],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
          commercialStatus: null,
        }),
      } as unknown as FacilityCadastroCompletionService,
      cadastroRepository: {
        // A brand-new draft version over an already approved one, in the order
        // the repository returns them: version DESC. The use case picks the
        // working document by scanning this list, so the order is part of the
        // contract being exercised, not incidental setup.
        listDocumentsByFacility: async () => [
          {
            id: 101,
            facilityId: 1,
            facilityVerticalProfileId: null,
            requirementId: 1,
            title: "Identidade",
            status: "DRAFT",
            version: 2,
            reviewComment: null,
            submittedAt: null,
          },
          {
            id: 200,
            facilityId: 1,
            facilityVerticalProfileId: null,
            requirementId: 1,
            title: "Identidade",
            status: "APPROVED",
            version: 1,
            reviewComment: null,
            submittedAt: now,
          },
        ],
        listDocumentFilesForDocuments,
      } as never,
    }).execute({ facilityId: 1, scope: globalScope });

    const doc = result.documents[0]!;
    // The pill is unchanged: an approved document still reads "Aprovado".
    expect(doc.uiStatus).toBe("approved");
    // Working document = the draft.
    expect(doc.documentId).toBe(101);
    expect(doc.documentStatus).toBe("DRAFT");
    expect(doc.files.map((f) => f.fileAssetId)).toEqual([901]);
    // Approved document keeps its own files, for the "DOCUMENTO ATUAL" card.
    expect(doc.currentApproved?.documentId).toBe(200);
    expect(doc.currentApproved?.version).toBe(1);
    expect(doc.currentApproved?.fileCount).toBe(1);
    expect(doc.currentApproved?.files).toEqual([
      {
        fileAssetId: 900,
        position: 1,
        role: "PAGE",
        fileName: "aprovado.pdf",
        status: "READY",
        contentType: "application/pdf",
      },
    ]);

    // What the mobile compose screen does every 2 s: find its requirement row,
    // then match the file it just uploaded by `fileAssetId`. Before this fix
    // the row carried the approved document's file (900), the match failed and
    // the tile stayed "Processando..." forever with "Enviar" disabled.
    const polled = result.documents.find((d) => d.requirementId === 1)!;
    const match = polled.files.find((f) => f.fileAssetId === 901);
    expect(match).toBeDefined();
    expect(match!.status).toBe("READY");
  });

  it("falls back to the approved document when there is no draft", async () => {
    const files = [
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
    ];
    const listDocumentFilesForDocuments = mock(async (ids: number[]) =>
      files.filter((f) => ids.includes(f.submissionDocumentId))
    );

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CPF" }),
        findVerticalProfilesByFacilityIds: async () => new Map(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [requirement(1, "identidade", "CPF")],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
          commercialStatus: null,
        }),
      } as unknown as FacilityCadastroCompletionService,
      cadastroRepository: {
        // Nothing in progress — APPROVED is a closed status, so there is no
        // working document and the checklist falls through to the approved one.
        listDocumentsByFacility: async () => [
          {
            id: 200,
            facilityId: 1,
            facilityVerticalProfileId: null,
            requirementId: 1,
            title: "Identidade",
            status: "APPROVED",
            version: 1,
            reviewComment: null,
            submittedAt: now,
          },
        ],
        listDocumentFilesForDocuments,
      } as never,
    }).execute({ facilityId: 1, scope: globalScope });

    const doc = result.documents[0]!;
    expect(doc.uiStatus).toBe("approved");
    expect(doc.documentId).toBe(200);
    expect(doc.documentStatus).toBe("APPROVED");
    expect(doc.files.map((f) => f.fileAssetId)).toEqual([900]);
    expect(doc.currentApproved?.files.map((f) => f.fileAssetId)).toEqual([900]);
  });

  // The checklist used to ask per requirement: the working document, the
  // history, then the files of each — up to four round trips per row, which
  // made /cadastro the slowest endpoint on the clinic screen at ~1.7s measured
  // against production. Counting the calls is the only thing that stops that
  // returning, because the output is identical either way: an N+1 reintroduced
  // here would pass every other test in this file.
  it("reads documents and files once, whatever the requirement count", async () => {
    const documents = [
      // Three requirements, each with two versions: a superseded one and a
      // current one, so grouping and per-requirement ordering both get used.
      { id: 11, requirementId: 1, status: "APPROVED", version: 2 },
      { id: 12, requirementId: 1, status: "SUPERSEDED", version: 1 },
      { id: 21, requirementId: 2, status: "DRAFT", version: 2 },
      { id: 22, requirementId: 2, status: "REJECTED", version: 1 },
      { id: 31, requirementId: 3, status: "SUBMITTED", version: 1 },
    ].map((d) => ({
      ...d,
      facilityId: 1,
      facilityVerticalProfileId: null,
      title: "Doc",
      reviewComment: null,
      submittedAt: now,
    }));

    const listDocumentsByFacility = mock(async () => documents);
    const listDocumentFilesForDocuments = mock(async (_ids: number[]) => []);

    const result = await new GetFacilityCadastroChecklistUseCase({
      facilityRepository: {
        findById: async () => facility({ legalDocumentType: "CPF" }),
        findVerticalProfilesByFacilityIds: async () => new Map(),
      } as unknown as FacilityRepository,
      conformityRepository: {
        findActiveRequirements: async () => [
          requirement(1, "identidade", "CPF"),
          requirement(2, "crm", "CPF"),
          requirement(3, "comprovante_endereco", "CPF"),
        ],
        findRecordsByFacility: async () => [],
      } as unknown as ConformityRepository,
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
          commercialStatus: null,
        }),
      } as unknown as FacilityCadastroCompletionService,
      cadastroRepository: {
        listDocumentsByFacility,
        listDocumentFilesForDocuments,
      } as never,
    }).execute({ facilityId: 1, scope: globalScope });

    expect(result.documents).toHaveLength(3);
    expect(listDocumentsByFacility).toHaveBeenCalledTimes(1);
    expect(listDocumentFilesForDocuments).toHaveBeenCalledTimes(1);

    // Grouping still resolves each requirement independently: APPROVED with no
    // open version is the working document, DRAFT wins over the REJECTED one
    // beneath it, and SUBMITTED stands alone.
    const byRequirement = new Map(
      result.documents.map((d) => [d.requirementId, d])
    );
    expect(byRequirement.get(1)?.documentId).toBe(11);
    expect(byRequirement.get(2)?.documentId).toBe(21);
    expect(byRequirement.get(3)?.documentId).toBe(31);

    // Only the documents actually rendered are fetched — the superseded and
    // rejected versions underneath are history, and nothing reads their files.
    const requestedIds = listDocumentFilesForDocuments.mock.calls[0]![0] as number[];
    expect([...requestedIds].sort((a, b) => a - b)).toEqual([11, 21, 31]);
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
    expect(result.commercialStatus).toBe("REGISTERED");
    // Spec 0010 §1.6: completion is recorded on the profile ONLY. The facility
    // must not be touched — it used to carry a parallel conformity_status that
    // said COMPLETE for every linha as soon as one of them completed.
    expect(update).not.toHaveBeenCalled();
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
    expect(result.commercialStatus).toBe("SUSPENDED");
    expect(update).not.toHaveBeenCalled();
    expect(updateVerticalProfileCommercialStatus).toHaveBeenCalledWith({
      facilityId: 1,
      verticalId,
      commercialStatus: "SUSPENDED",
    });
  });

  it("treats an APPROVED document per requirement as complete", async () => {
    const update = mock(async () => facility());
    const updateVerticalProfileCommercialStatus = mock(async () => {});
    const service = new FacilityCadastroCompletionService({
      facilityRepository: {
        findById: async () =>
          facility({
            legalDocumentType: "CNPJ",
            billingEmail: "fin@ex.com",
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
            id: `doc-${requirementId}`,
            requirementId,
            status: "APPROVED",
          },
        ],
      } as never,
    });

    const result = await service.evaluateAndApply(1, verticalId);
    expect(result.complete).toBe(true);
    expect(update).not.toHaveBeenCalled();
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
      completionService: {
        evaluateAndApply: async () => ({
          complete: false,
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
