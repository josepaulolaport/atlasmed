import { describe, expect, it, mock } from "bun:test";
import type { ScopeContext } from "@atlasmed/access";
import type { ConformityRepository } from "../interfaces/conformity.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { ListCadastroSubmissionsUseCase } from "./facility-cadastro.use-cases";

/**
 * D-07: the ops review queue never filtered by scope, so every reviewer saw
 * every territory. It cannot use `assertResourceInScope` — a list has no single
 * resource to check — so the restriction is pushed into the query, and that is
 * exactly the kind of fix that passes review while doing nothing.
 *
 * These assert on the argument reaching the repository, because that argument
 * *is* the security boundary.
 */
const baseScope: Omit<ScopeContext, "isGlobal" | "facilityIds"> = {
  assignedTerritoryIds: [],
  effectiveTerritoryIds: [],
  analyticsEffectiveTerritoryIds: [],
  territoryIds: [],
  analyticsFacilityIds: [],
  clinicIds: [],
  analyticsClinicIds: [],
  managedUserIds: [],
  isOperationallyActive: true,
};

function scopeWith(isGlobal: boolean, facilityIds: number[]): ScopeContext {
  return { ...baseScope, isGlobal, facilityIds } as ScopeContext;
}

function useCaseWith(listDocumentsForReview: ReturnType<typeof mock>) {
  return new ListCadastroSubmissionsUseCase({
    conformityRepository: {
      findSubmittedRecords: async () => ({ records: [], total: 0 }),
    } as unknown as ConformityRepository,
    facilityRepository: {
      findById: async () => null,
    } as unknown as FacilityRepository,
    cadastroRepository: {
      listDocumentsForReview,
      listDocumentFiles: async () => [],
    } as never,
  });
}

describe("cadastro review queue scoping", () => {
  it("restricts the query to the reviewer's facilities", async () => {
    const listDocumentsForReview = mock(async (_input: Record<string, unknown>) => ({
      items: [],
      total: 0,
    }));

    await useCaseWith(listDocumentsForReview).execute({
      scope: scopeWith(false, [7, 9]),
    });

    expect(listDocumentsForReview).toHaveBeenCalledTimes(1);
    expect(listDocumentsForReview.mock.calls[0]![0]).toMatchObject({
      facilityIds: [7, 9],
    });
  });

  it("leaves a global reviewer unrestricted", async () => {
    const listDocumentsForReview = mock(async (_input: Record<string, unknown>) => ({
      items: [],
      total: 0,
    }));

    await useCaseWith(listDocumentsForReview).execute({
      scope: scopeWith(true, []),
    });

    // Undefined, not []. An empty array would mean "no facilities" and would
    // silently empty ADMIN's queue.
    expect(
      (listDocumentsForReview.mock.calls[0]![0] as { facilityIds?: number[] })
        .facilityIds
    ).toBeUndefined();
  });

  it("returns nothing for a scoped reviewer with no facilities", async () => {
    const listDocumentsForReview = mock(async (_input: Record<string, unknown>) => ({
      items: [],
      total: 0,
    }));

    const result = await useCaseWith(listDocumentsForReview).execute({
      scope: scopeWith(false, []),
    });

    // The repository is never reached: an empty scope means "nothing", and
    // relying on an empty IN () to express that is how it becomes "everything".
    expect(listDocumentsForReview).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});
