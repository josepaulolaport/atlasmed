import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import { ReviewCadastroDocumentUseCase } from "./cadastro-submission.use-cases";

/**
 * Retention: which verdict schedules deletion of the bytes (spec 0011 §6,
 * ADR 0008 §5).
 *
 * | state    | policy                        |
 * |----------|-------------------------------|
 * | REJECTED | files deleted after 1 week    |
 * | APPROVED | never deleted                 |
 *
 * Getting APPROVED wrong destroys the evidence a clinic was compliant at a
 * point in time, and nothing would notice until an audit asked for it. Getting
 * the clear-on-approval wrong is subtler and just as bad: a document rejected
 * and later approved would keep the purge date from its earlier verdict and be
 * deleted a week after being accepted.
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

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function reviewUseCase() {
  const setPurgeAfterForDocument = mock(async () => {});

  return {
    setPurgeAfterForDocument,
    useCase: new ReviewCadastroDocumentUseCase({
      facilityRepository: {
        findById: async () => ({ id: 1 }),
        findVerticalProfilesByFacilityIds: async () =>
          new Map([[1, [{ verticalId: 1, isActive: true }]]]),
      },
      conformityRepository: { findActiveRequirements: async () => [] },
      completionService: { evaluateAndApply: async () => ({ complete: false }) },
      cadastroRepository: {
        findDocumentById: async () => ({
          id: 10,
          facilityId: 1,
          requirementId: 1,
          facilityVerticalProfileId: null,
          status: "UNDER_REVIEW",
          version: 2,
          title: "Identidade",
          validUntil: null,
          // No validity on this requirement, so the reviewer is not asked for a
          // date and retention is the only thing under test here.
          requirement: { name: "Identidade", requiresValidityDate: false },
        }),
        createReviewDecision: async () => {},
        updateDocumentStatus: async () => ({ id: 10, version: 2 }),
        setPurgeAfterForDocument,
      },
    } as never),
  };
}

describe("retention on review", () => {
  it("schedules a rejected document's files for deletion in a week", async () => {
    const { useCase, setPurgeAfterForDocument } = reviewUseCase();
    const before = Date.now();

    await useCase.execute({
      facilityId: 1,
      documentId: 10,
      userId: 9,
      scope: globalScope,
      decision: "REJECTED",
      comment: "ilegível",
    });

    expect(setPurgeAfterForDocument).toHaveBeenCalledTimes(1);
    const call = setPurgeAfterForDocument.mock.calls[0]![0] as {
      documentId: number;
      purgeAfter: Date | null;
    };
    expect(call.documentId).toBe(10);
    const scheduled = call.purgeAfter!.getTime();
    // A week out, allowing for the clock moving during the call.
    expect(scheduled).toBeGreaterThanOrEqual(before + ONE_WEEK_MS - 5_000);
    expect(scheduled).toBeLessThanOrEqual(Date.now() + ONE_WEEK_MS + 5_000);
  });

  it("clears any purge date when a document is approved", async () => {
    const { useCase, setPurgeAfterForDocument } = reviewUseCase();

    await useCase.execute({
      facilityId: 1,
      documentId: 10,
      userId: 9,
      scope: globalScope,
      decision: "APPROVED",
    });

    // Null, not "leave it alone": this document may have been rejected on a
    // previous pass, and that purge date must not outlive the rejection.
    expect(setPurgeAfterForDocument).toHaveBeenCalledWith({
      documentId: 10,
      purgeAfter: null,
    });
  });

  it("leaves retention untouched when changes are merely requested", async () => {
    const { useCase, setPurgeAfterForDocument } = reviewUseCase();

    await useCase.execute({
      facilityId: 1,
      documentId: 10,
      userId: 9,
      scope: globalScope,
      decision: "CHANGES_REQUESTED",
      comment: "faltou o verso",
    });

    // The rep is expected to come back to this document. Deleting the files
    // they are about to correct would be actively unhelpful.
    expect(setPurgeAfterForDocument).not.toHaveBeenCalled();
  });
});
