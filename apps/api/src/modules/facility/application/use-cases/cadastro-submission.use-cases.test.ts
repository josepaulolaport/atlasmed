import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import type { FacilityCadastroCompletionService } from "../services/facility-cadastro-completion.service";
import {
  CreateCadastroDocumentUseCase,
  SubmitCadastroRequirementUseCase,
} from "./cadastro-submission.use-cases";

const now = new Date("2026-08-10T12:00:00.000Z");

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

function requirement(id: number, slug: string, verticalId: number | null = null) {
  return {
    id,
    slug,
    name: slug,
    description: null,
    verticalId,
    appliesToLegalDocumentType: null,
    isActive: true,
    allowedMimeTypes: ["application/pdf"],
    maxFiles: 10,
    maxFileSizeBytes: 52_428_800,
    maxCombinedSizeBytes: 209_715_200,
    requiresFrontAndBack: false,
    createdAt: now,
    updatedAt: now,
  };
}

function document(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    facilityId: 1,
    facilityVerticalProfileId: null,
    requirementId: 1,
    title: "Identidade",
    status: "READY",
    version: 1,
    reviewComment: null,
    submittedByUserId: null,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const facilityRepository = {
  findById: async () => ({ id: 1, legalDocumentType: "CPF" }),
} as unknown as FacilityRepository;

const completionService = {
  evaluateAndApply: async () => ({ complete: false, commercialStatus: null }),
} as unknown as FacilityCadastroCompletionService;

/**
 * The wedge ADR 0007 removes.
 *
 * Under the package, `submitCadastroRequirement` flipped the *package* to
 * UNDER_REVIEW, and every upload path gated on the package being DRAFT or
 * CHANGES_REQUESTED. Sending one document therefore froze every other
 * requirement for that clinic until a reviewer acted — and nothing errored, the
 * rep just found the rest of the checklist read-only.
 *
 * These tests pin the two halves: submitting writes one row, and the clinic's
 * other requirements stay open.
 */
describe("submitting one cadastro requirement", () => {
  it("writes the status onto that document alone", async () => {
    const updateDocumentStatus = mock(async (_input: Record<string, unknown>) =>
      document({ status: "UNDER_REVIEW", submittedAt: now })
    );
    const useCase = new SubmitCadastroRequirementUseCase({
      facilityRepository,
      completionService,
      conformityRepository: {
        findActiveRequirements: async () => [requirement(1, "identidade")],
      } as unknown as ConformityRepository,
      cadastroRepository: {
        findWorkingDocument: async () => document(),
        listDocumentFiles: async () => [
          { fileAssetId: 5, position: 1, role: "PAGE", fileAsset: { status: "READY" } },
        ],
        updateDocumentStatus,
      } as never,
    });

    const result = await useCase.execute({
      facilityId: 1,
      requirementId: 1,
      userId: 7,
      scope: globalScope,
    });

    expect(result.status).toBe("UNDER_REVIEW");
    expect(updateDocumentStatus).toHaveBeenCalledTimes(1);
    expect(updateDocumentStatus.mock.calls[0]![0]).toMatchObject({
      id: 100,
      status: "UNDER_REVIEW",
      submittedByUserId: 7,
    });
  });

  it("leaves the clinic's other requirements open for upload", async () => {
    // Requirement 1 is already under review; the rep now opens requirement 2.
    const createDocument = mock(async (_input: Record<string, unknown>) => document({ id: 200, requirementId: 2 }));
    const useCase = new CreateCadastroDocumentUseCase({
      facilityRepository,
      completionService,
      conformityRepository: {
        findRequirementById: async () => requirement(2, "comprovante"),
      } as unknown as ConformityRepository,
      cadastroRepository: {
        // Nothing open for requirement 2 yet.
        findWorkingDocument: async () => null,
        listDocumentsForFacilityRequirement: async () => [],
        createDocument,
        findDocumentById: async () => document({ id: 200, requirementId: 2 }),
        listDocumentFiles: async () => [],
      } as never,
    });

    const created = await useCase.execute({
      facilityId: 1,
      requirementId: 2,
      scope: globalScope,
    });

    expect(created?.id).toBe(200);
    expect(createDocument).toHaveBeenCalledTimes(1);
  });

  it("refuses to reopen a document that is already under review", async () => {
    const useCase = new CreateCadastroDocumentUseCase({
      facilityRepository,
      completionService,
      conformityRepository: {
        findRequirementById: async () => requirement(1, "identidade"),
      } as unknown as ConformityRepository,
      cadastroRepository: {
        findWorkingDocument: async () => document({ status: "UNDER_REVIEW" }),
      } as never,
    });

    await expect(
      useCase.execute({ facilityId: 1, requirementId: 1, scope: globalScope })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

/**
 * A requirement with no linha produces a facility-scoped document: uploaded
 * once, counts for every linha. A requirement that names a linha gets that
 * linha's profile. Getting this backwards would silently duplicate a shared
 * document per linha, or leak a linha-specific one across all of them.
 */
describe("which linha a new document belongs to", () => {
  it("leaves the profile null for a requirement that applies to every linha", async () => {
    const createDocument = mock(async (_input: Record<string, unknown>) => document({ id: 300 }));
    const ensureVerticalProfile = mock(async (_input: Record<string, unknown>) => ({
      id: 55,
      verticalId: 9,
    }));

    await new CreateCadastroDocumentUseCase({
      facilityRepository: {
        findById: async () => ({ id: 1, legalDocumentType: "CNPJ" }),
        ensureVerticalProfile,
      } as unknown as FacilityRepository,
      completionService,
      conformityRepository: {
        findRequirementById: async () => requirement(1, "carta_cnpj", null),
      } as unknown as ConformityRepository,
      cadastroRepository: {
        findWorkingDocument: async () => null,
        listDocumentsForFacilityRequirement: async () => [],
        createDocument,
        findDocumentById: async () => document({ id: 300 }),
        listDocumentFiles: async () => [],
      } as never,
    }).execute({ facilityId: 1, requirementId: 1, scope: globalScope });

    expect(ensureVerticalProfile).not.toHaveBeenCalled();
    expect(createDocument.mock.calls[0]![0]).toMatchObject({
      facilityId: 1,
      facilityVerticalProfileId: null,
    });
  });

  it("attaches the linha's profile for a vertical-scoped requirement", async () => {
    const createDocument = mock(async (_input: Record<string, unknown>) => document({ id: 301 }));
    const ensureVerticalProfile = mock(async (_input: Record<string, unknown>) => ({
      id: 55,
      verticalId: 9,
    }));

    await new CreateCadastroDocumentUseCase({
      facilityRepository: {
        findById: async () => ({ id: 1, legalDocumentType: "CNPJ" }),
        ensureVerticalProfile,
      } as unknown as FacilityRepository,
      completionService,
      conformityRepository: {
        findRequirementById: async () => requirement(2, "licenca", 9),
      } as unknown as ConformityRepository,
      cadastroRepository: {
        findWorkingDocument: async () => null,
        listDocumentsForFacilityRequirement: async () => [],
        createDocument,
        findDocumentById: async () => document({ id: 301 }),
        listDocumentFiles: async () => [],
      } as never,
    }).execute({ facilityId: 1, requirementId: 2, scope: globalScope });

    expect(ensureVerticalProfile).toHaveBeenCalledWith({
      facilityId: 1,
      verticalId: 9,
    });
    expect(createDocument.mock.calls[0]![0]).toMatchObject({
      facilityVerticalProfileId: 55,
    });
  });

  it("opens the next version over a finished attempt", async () => {
    const createDocument = mock(async (_input: Record<string, unknown>) => document({ id: 302, version: 3 }));

    await new CreateCadastroDocumentUseCase({
      facilityRepository,
      completionService,
      conformityRepository: {
        findRequirementById: async () => requirement(1, "identidade"),
      } as unknown as ConformityRepository,
      cadastroRepository: {
        // Nothing open — v2 was rejected, v1 superseded before it.
        findWorkingDocument: async () => null,
        listDocumentsForFacilityRequirement: async () => [
          document({ id: 201, version: 2, status: "REJECTED" }),
          document({ id: 200, version: 1, status: "SUPERSEDED" }),
        ],
        createDocument,
        findDocumentById: async () => document({ id: 302, version: 3 }),
        listDocumentFiles: async () => [],
      } as never,
    }).execute({ facilityId: 1, requirementId: 1, scope: globalScope });

    expect(createDocument.mock.calls[0]![0]).toMatchObject({ version: 3 });
  });
});
