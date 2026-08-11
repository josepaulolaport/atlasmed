import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import {
  ReviewCadastroDocumentUseCase,
  SubmitCadastroRequirementUseCase,
} from "./cadastro-submission.use-cases";
import { ValidationError } from "../../../../shared/errors";

/**
 * Who gets to say when a document expires (spec 0011 §3.3, ADR 0008 §6).
 *
 * The rep enters the date at submit, only where the requirement declares one;
 * the reviewer confirms or corrects it while approving. Both are looking at the
 * same physical document, and the reviewer's answer wins.
 *
 * These paths guard a compliance fact, so the failure mode is quiet: a missing
 * date means the expiry warning simply never fires for that clinic and nobody
 * finds out until the licence has lapsed.
 */
const globalScope = {
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
} as ScopeContext;

function requirement(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "licenca_sanitaria",
    name: "Licença Sanitária",
    description: null,
    appliesToLegalDocumentType: null,
    allowedMimeTypes: ["image/jpeg"],
    maxFiles: 10,
    maxFileSizeBytes: 1000,
    maxCombinedSizeBytes: 10_000,
    requiresFrontAndBack: false,
    requiresValidityDate: true,
    isActive: true,
    ...overrides,
  };
}

function submitUseCase(options: {
  requiresValidityDate?: boolean;
  updateDocumentStatus?: ReturnType<typeof mock>;
}) {
  const req = requirement({
    requiresValidityDate: options.requiresValidityDate ?? true,
  });
  const update =
    options.updateDocumentStatus ??
    mock(async (input: Record<string, unknown>) => ({
      id: 10,
      version: 1,
      submittedAt: new Date(),
      validUntil: (input.validUntil as string) ?? null,
    }));

  return {
    update,
    useCase: new SubmitCadastroRequirementUseCase({
      facilityRepository: { findById: async () => ({ id: 1, legalDocumentType: "CNPJ" }) },
      conformityRepository: { findActiveRequirements: async () => [req] },
      cadastroRepository: {
        findWorkingDocument: async () => ({
          id: 10,
          facilityId: 1,
          requirementId: 1,
          status: "READY",
          version: 1,
          validUntil: null,
          requirement: req,
        }),
        listDocumentFiles: async () => [
          { fileAssetId: 1, role: "PAGE", fileAsset: { status: "READY" } },
        ],
        deleteDocumentFileByFileAssetId: async () => {},
        updateDocumentStatus: update,
      },
    } as never),
  };
}

describe("the rep's validity date at submit", () => {
  it("stores the date where the requirement declares one", async () => {
    const { useCase, update } = submitUseCase({});

    const result = await useCase.execute({
      facilityId: 1,
      requirementId: 1,
      userId: 7,
      scope: globalScope,
      validUntil: "2027-06-30",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ validUntil: "2027-06-30" })
    );
    expect(result.validUntil).toBe("2027-06-30");
  });

  it("refuses to submit without one when the requirement declares it", async () => {
    const { useCase, update } = submitUseCase({});

    await expect(
      useCase.execute({ facilityId: 1, requirementId: 1, userId: 7, scope: globalScope })
    ).rejects.toBeInstanceOf(ValidationError);

    // Nothing may be written: a document submitted without its date would be
    // approved with no expiry and warn nobody, ever.
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a date on a requirement that has no validity", async () => {
    // Silently dropping it would hide a client bug and lose what the rep typed.
    const { useCase, update } = submitUseCase({ requiresValidityDate: false });

    await expect(
      useCase.execute({
        facilityId: 1,
        requirementId: 1,
        userId: 7,
        scope: globalScope,
        validUntil: "2027-06-30",
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a date that has already passed", async () => {
    const { useCase } = submitUseCase({});

    await expect(
      useCase.execute({
        facilityId: 1,
        requirementId: 1,
        userId: 7,
        scope: globalScope,
        validUntil: "2020-01-01",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses a date that is not a real day", async () => {
    const { useCase } = submitUseCase({});

    await expect(
      useCase.execute({
        facilityId: 1,
        requirementId: 1,
        userId: 7,
        scope: globalScope,
        validUntil: "2027-02-30",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("leaves the column alone when no validity applies", async () => {
    const { useCase, update } = submitUseCase({ requiresValidityDate: false });

    await useCase.execute({
      facilityId: 1,
      requirementId: 1,
      userId: 7,
      scope: globalScope,
    });

    const call = update.mock.calls[0]![0] as Record<string, unknown>;
    expect("validUntil" in call).toBe(false);
  });
});

function reviewUseCase(options: {
  existingValidUntil?: string | null;
  requiresValidityDate?: boolean;
}) {
  const req = requirement({
    requiresValidityDate: options.requiresValidityDate ?? true,
  });
  const update = mock(async (input: Record<string, unknown>) => ({
    id: 10,
    version: 1,
    validUntil: (input.validUntil as string) ?? null,
  }));

  return {
    update,
    useCase: new ReviewCadastroDocumentUseCase({
      facilityRepository: {
        findById: async () => ({ id: 1 }),
        // One active profile, so approval can resolve the linha to re-evaluate
        // for completion without needing an explicit verticalId.
        findVerticalProfilesByFacilityIds: async () =>
          new Map([[1, [{ verticalId: 1, isActive: true }]]]),
      },
      conformityRepository: { findActiveRequirements: async () => [req] },
      completionService: { evaluateAndApply: async () => ({ complete: false }) },
      cadastroRepository: {
        findDocumentById: async () => ({
          id: 10,
          facilityId: 1,
          requirementId: 1,
          facilityVerticalProfileId: null,
          status: "UNDER_REVIEW",
          version: 1,
          title: "Licença Sanitária",
          validUntil: options.existingValidUntil ?? null,
          requirement: req,
        }),
        createReviewDecision: async () => {},
        updateDocumentStatus: update,
      },
    } as never),
  };
}

describe("the reviewer's confirm-or-correct on approval", () => {
  it("keeps the rep's date when the reviewer sends none", async () => {
    const { useCase, update } = reviewUseCase({ existingValidUntil: "2027-06-30" });

    await useCase.execute({
      facilityId: 1,
      documentId: 10,
      userId: 9,
      scope: globalScope,
      decision: "APPROVED",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ validUntil: "2027-06-30" })
    );
  });

  it("lets the reviewer overwrite what the rep typed", async () => {
    const { useCase, update } = reviewUseCase({ existingValidUntil: "2027-06-30" });

    await useCase.execute({
      facilityId: 1,
      documentId: 10,
      userId: 9,
      scope: globalScope,
      decision: "APPROVED",
      validUntil: "2027-07-15",
    });

    // The reviewer is holding the document open; their reading wins.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ validUntil: "2027-07-15" })
    );
  });

  it("accepts a correction to a date already past", async () => {
    // Not a mistake to refuse: the reviewer is recording what the document says,
    // and the derived warning will show EXPIRED, which is the correct outcome.
    const { useCase, update } = reviewUseCase({ existingValidUntil: "2027-06-30" });

    await useCase.execute({
      facilityId: 1,
      documentId: 10,
      userId: 9,
      scope: globalScope,
      decision: "APPROVED",
      validUntil: "2020-01-01",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ validUntil: "2020-01-01" })
    );
  });

  it("refuses to approve with no date at all when one is required", async () => {
    // Approval is the last moment anyone looks. Letting it through here is how
    // a clinic ends up with a licence that warns nobody.
    const { useCase } = reviewUseCase({ existingValidUntil: null });

    await expect(
      useCase.execute({
        facilityId: 1,
        documentId: 10,
        userId: 9,
        scope: globalScope,
        decision: "APPROVED",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not write a validity when rejecting", async () => {
    // A rejected document's expiry is meaningless — it was refused as evidence.
    const { useCase, update } = reviewUseCase({ existingValidUntil: "2027-06-30" });

    await useCase.execute({
      facilityId: 1,
      documentId: 10,
      userId: 9,
      scope: globalScope,
      decision: "REJECTED",
      comment: "ilegível",
    });

    const call = update.mock.calls[0]![0] as Record<string, unknown>;
    expect("validUntil" in call).toBe(false);
  });
});
