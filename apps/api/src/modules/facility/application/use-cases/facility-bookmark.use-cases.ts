import type { ScopeContext } from "@atlasmed/access";
import { assertResourceInScope } from "@atlasmed/access";
import type { FacilityBookmarkRepository } from "../interfaces/facility-bookmark.repository.interface";
import type { FacilityRepository } from "../interfaces/facility.repository.interface";
import { orderSearchResultsById } from "./facility.use-cases";
import { serializeFacility } from "../mappers/facility.mapper";

function paginationOf(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}

function emptyPage(page: number, limit: number, total: number) {
  return { data: [], pagination: paginationOf(page, limit, total) };
}

interface Dependencies {
  facilityBookmarkRepository: FacilityBookmarkRepository;
  facilityRepository: FacilityRepository;
}

interface ToggleInput {
  facilityId: number;
  userId: number;
  scope: ScopeContext;
}

/**
 * Saving a clinic is gated on being able to *see* it.
 *
 * `assertResourceInScope` here matches `facility-note.use-cases.ts`, which is
 * the closest existing feature — private, caller-owned data hanging off a
 * facility. Without it a rep could save a clinic they have no access to; the
 * list would hide it, but the row would exist and a later territory grant would
 * surface a bookmark they never legitimately made.
 */
export class AddFacilityBookmarkUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: ToggleInput): Promise<{ bookmarked: true }> {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    await this.deps.facilityBookmarkRepository.add({
      userId: input.userId,
      facilityId: input.facilityId,
    });

    // Idempotent by the unique index, so the answer is the same whether this
    // created a row or found one. The client toggled optimistically already.
    return { bookmarked: true };
  }
}

export class RemoveFacilityBookmarkUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: ToggleInput): Promise<{ bookmarked: false }> {
    assertResourceInScope(input.scope, "facility", input.facilityId);

    await this.deps.facilityBookmarkRepository.remove({
      userId: input.userId,
      facilityId: input.facilityId,
    });

    return { bookmarked: false };
  }
}

/**
 * The saved clinics, newest first, in the same shape the Explore list returns.
 *
 * Hydrated through `facilityRepository.findAllByIds` rather than a second
 * mapping of its own — that is the path Meili search already uses, so the cards
 * on this page cannot drift from the cards everywhere else. Order comes from
 * the bookmark table and is restored after hydration, since `findAllByIds`
 * sorts by its own rules.
 */
export class ListFacilityBookmarksUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    userId: number;
    scope: ScopeContext;
    page: number;
    limit: number;
  }) {
    const { items, total } =
      await this.deps.facilityBookmarkRepository.listForUser({
        userId: input.userId,
        scope: input.scope,
        page: input.page,
        limit: input.limit,
      });

    if (items.length === 0) {
      return emptyPage(input.page, input.limit, total);
    }

    const ids = items.map((item) => item.facilityId);
    const facilities = await this.deps.facilityRepository.findAllByIds({
      ids,
      userId: input.userId,
      scope: input.scope.isGlobal
        ? { isGlobal: true }
        : { isGlobal: false, facilityIds: input.scope.facilityIds },
    });

    /**
     * Hydration re-applies the canonical eligibility rules, so it can return
     * fewer rows than were asked for. That would mean this feature's scope
     * filter and the canonical one disagree — worth noticing rather than
     * silently shipping a short page, so `total` stays honest and the count
     * mismatch is visible to the caller.
     */
    /**
     * `{ data, pagination }` and a real DTO, because that is what every other
     * list endpoint returns and what the app's `PaginatedFacilities` parses.
     * Returning the repository record straight out would also leak Drizzle row
     * shapes through the API.
     */
    return {
      data: orderSearchResultsById(facilities, ids).map((facility) =>
        serializeFacility(facility, input.scope.assignedVerticalIds)
      ),
      pagination: paginationOf(input.page, input.limit, total),
    };
  }
}
