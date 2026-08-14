import { describe, expect, test } from "bun:test";
import { ForbiddenError } from "@atlasmed/access";
import type { ScopeContext } from "@atlasmed/access";
import {
  AddFacilityBookmarkUseCase,
  ListFacilityBookmarksUseCase,
  RemoveFacilityBookmarkUseCase,
} from "./facility-bookmark.use-cases";

/** Minimal shape `serializeFacility` can map without throwing. */
function facilityRecord(id: number) {
  return {
    id,
    name: `Clinic ${id}`,
    displayName: `Clinic ${id}`,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    verticalProfiles: [],
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
    add: async () => {},
    remove: async () => {},
    listForUser: async () => ({ items: [], total: 0 }),
    findBookmarkedIds: async () => [],
    ...overrides,
  } as never;
}

describe("facility bookmark toggles", () => {
  test("refuses to save a clinic outside the caller's scope", async () => {
    let added = false;
    const useCase = new AddFacilityBookmarkUseCase({
      facilityBookmarkRepository: bookmarkRepo({
        add: async () => {
          added = true;
        },
      }),
      facilityRepository: {} as never,
    });

    await expect(
      useCase.execute({ facilityId: 99, userId: 1, scope: scope([1, 2]) })
    ).rejects.toBeInstanceOf(ForbiddenError);
    // The write must not happen — a row created here would surface later if the
    // rep ever gained that territory.
    expect(added).toBe(false);
  });

  test("refuses to remove a clinic outside scope", async () => {
    const useCase = new RemoveFacilityBookmarkUseCase({
      facilityBookmarkRepository: bookmarkRepo(),
      facilityRepository: {} as never,
    });

    await expect(
      useCase.execute({ facilityId: 99, userId: 1, scope: scope([1]) })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("a global scope may save anything", async () => {
    const useCase = new AddFacilityBookmarkUseCase({
      facilityBookmarkRepository: bookmarkRepo(),
      facilityRepository: {} as never,
    });

    expect(
      await useCase.execute({ facilityId: 99, userId: 1, scope: scope([], true) })
    ).toEqual({ bookmarked: true });
  });
});

describe("ListFacilityBookmarksUseCase", () => {
  test("returns hydrated clinics in bookmark order", async () => {
    const useCase = new ListFacilityBookmarksUseCase({
      facilityBookmarkRepository: bookmarkRepo({
        listForUser: async () => ({
          items: [
            { facilityId: 3, createdAt: new Date("2026-03-03") },
            { facilityId: 1, createdAt: new Date("2026-02-02") },
          ],
          total: 2,
        }),
      }),
      facilityRepository: {
        findAllByIds: async () => [facilityRecord(1), facilityRecord(3)],
      } as never,
    });

    const result = await useCase.execute({
      userId: 1,
      scope: scope([1, 3]),
      page: 1,
      limit: 20,
    });
    expect(result.data.map((f: { id: number }) => f.id)).toEqual([3, 1]);
  });

  test("skips hydration when there is nothing saved", async () => {
    let hydrated = false;
    const useCase = new ListFacilityBookmarksUseCase({
      facilityBookmarkRepository: bookmarkRepo(),
      facilityRepository: {
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
    expect(result.pagination.total).toBe(0);
    expect(hydrated).toBe(false);
  });
});
