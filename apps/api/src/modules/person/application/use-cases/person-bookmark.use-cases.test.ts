import { describe, expect, test } from "bun:test";
import { ForbiddenError } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import { ResourceNotFoundError } from "../../../../shared/errors";
import {
  AddPersonBookmarkUseCase,
  ListPersonBookmarksUseCase,
} from "./person-bookmark.use-cases";

/** Minimal shape `serializeSummary` can map without throwing. */
function professionalRecord(id: number) {
  return {
    id,
    firstName: `Doctor${id}`,
    lastName: "Silva",
    facilityIds: [1],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

function scope(facilityIds: number[], isGlobal = false): ScopeContext {
  return {
    isGlobal,
    assignedTerritoryIds: [],
    effectiveTerritoryIds: [],
    analyticsEffectiveTerritoryIds: [],
    territoryIds: [],
    facilityIds,
    analyticsFacilityIds: facilityIds,
    clinicIds: facilityIds,
    analyticsClinicIds: facilityIds,
    managedUserIds: [],
    isOperationallyActive: true,
  };
}

function bookmarkRepo(overrides: Record<string, unknown> = {}) {
  return {
    findActivePersonById: async () => ({ id: 7 }),
    isPersonInScope: async () => true,
    add: async () => {},
    remove: async () => {},
    listForUser: async () => ({ items: [], total: 0 }),
    findBookmarkedIds: async () => [],
    ...overrides,
  } as never;
}

describe("AddPersonBookmarkUseCase", () => {
  test("404s when the doctor does not exist or is soft-deleted", async () => {
    const useCase = new AddPersonBookmarkUseCase({
      personBookmarkRepository: bookmarkRepo({
        findActivePersonById: async () => null,
      }),
      healthcareProfessionalRepository: {} as never,
    });

    await expect(
      useCase.execute({ personId: 7, userId: 1, scope: scope([1]) })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  test("403s when the doctor exists but none of their clinics are visible", async () => {
    // Distinct from 404 on purpose — collapsing them would hide a permission
    // problem behind what looks like missing data.
    const useCase = new AddPersonBookmarkUseCase({
      personBookmarkRepository: bookmarkRepo({
        isPersonInScope: async () => false,
      }),
      healthcareProfessionalRepository: {} as never,
    });

    await expect(
      useCase.execute({ personId: 7, userId: 1, scope: scope([]) })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("saves when the doctor is visible", async () => {
    let added: unknown = null;
    const useCase = new AddPersonBookmarkUseCase({
      personBookmarkRepository: bookmarkRepo({
        add: async (input: unknown) => {
          added = input;
        },
      }),
      healthcareProfessionalRepository: {} as never,
    });

    expect(
      await useCase.execute({ personId: 7, userId: 1, scope: scope([1]) })
    ).toEqual({ bookmarked: true });
    expect(added).toEqual({ userId: 1, personId: 7 });
  });
});

describe("ListPersonBookmarksUseCase", () => {
  test("returns hydrated doctors in bookmark order, not hydration order", async () => {
    const useCase = new ListPersonBookmarksUseCase({
      personBookmarkRepository: bookmarkRepo({
        listForUser: async () => ({
          items: [
            { personId: 30, createdAt: new Date("2026-03-03") },
            { personId: 10, createdAt: new Date("2026-02-02") },
            { personId: 20, createdAt: new Date("2026-01-01") },
          ],
          total: 3,
        }),
      }),
      healthcareProfessionalRepository: {
        // Hydration sorts by its own rules; the page must not inherit that.
        findAllByIds: async () => [
          professionalRecord(10),
          professionalRecord(20),
          professionalRecord(30),
        ],
      } as never,
    });

    const result = await useCase.execute({
      userId: 1,
      scope: scope([1]),
      page: 1,
      limit: 20,
    });

    expect(result.data.map((p: { id: number }) => p.id)).toEqual([
      30, 10, 20,
    ]);
    expect(result.pagination.total).toBe(3);
  });

  test("a doctor that fails hydration is dropped, not rendered as a hole", async () => {
    const useCase = new ListPersonBookmarksUseCase({
      personBookmarkRepository: bookmarkRepo({
        listForUser: async () => ({
          items: [
            { personId: 10, createdAt: new Date() },
            { personId: 99, createdAt: new Date() },
          ],
          total: 2,
        }),
      }),
      healthcareProfessionalRepository: {
        findAllByIds: async () => [professionalRecord(10)],
      } as never,
    });

    const result = await useCase.execute({
      userId: 1,
      scope: scope([1]),
      page: 1,
      limit: 20,
    });
    expect(result.data.map((p: { id: number }) => p.id)).toEqual([10]);
  });

  test("skips hydration entirely when there are no bookmarks", async () => {
    let hydrated = false;
    const useCase = new ListPersonBookmarksUseCase({
      personBookmarkRepository: bookmarkRepo(),
      healthcareProfessionalRepository: {
        findAllByIds: async () => {
          hydrated = true;
          return [];
        },
      } as never,
    });

    const result = await useCase.execute({
      userId: 1,
      scope: scope([1]),
      page: 1,
      limit: 20,
    });
    expect(result.data).toEqual([]);
    expect(hydrated).toBe(false);
  });
});
