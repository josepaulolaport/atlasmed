import type { ScopeContext } from "@atlasmed/access";
import { ForbiddenError } from "@atlasmed/access";
import { ResourceNotFoundError } from "../../../../shared/errors";
import type { PersonBookmarkRepository } from "../interfaces/person-bookmark.repository.interface";
import type { HealthcareProfessionalRepository } from "../interfaces/healthcare-professional.repository.interface";
import { serializeSummary } from "./list-healthcare-professionals.use-case";

function paginationOf(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
}

interface Dependencies {
  personBookmarkRepository: PersonBookmarkRepository;
  healthcareProfessionalRepository: HealthcareProfessionalRepository;
}

interface ToggleInput {
  personId: number;
  userId: number;
  scope: ScopeContext;
}

/**
 * A doctor has no scope of their own — visibility is inherited from the clinics
 * they are attached to, which is how the professionals list already works. So
 * "may I save this doctor" is "is any of their clinics mine".
 *
 * Missing person is a 404; present-but-invisible is a 403, matching what
 * `assertResourceInScope` does for a facility. The two are kept distinct
 * deliberately: collapsing them into 404 would hide a genuine permission
 * problem behind what looks like bad data.
 */
async function assertVisibleDoctor(
  deps: Dependencies,
  input: ToggleInput
): Promise<void> {
  const person = await deps.personBookmarkRepository.findActivePersonById(
    input.personId
  );
  if (!person) {
    throw new ResourceNotFoundError("Person", input.personId);
  }

  const inScope = await deps.personBookmarkRepository.isPersonInScope({
    personId: input.personId,
    scope: input.scope,
  });
  if (!inScope) {
    throw new ForbiddenError("Resource outside scope: person");
  }
}

export class AddPersonBookmarkUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: ToggleInput): Promise<{ bookmarked: true }> {
    await assertVisibleDoctor(this.deps, input);

    await this.deps.personBookmarkRepository.add({
      userId: input.userId,
      personId: input.personId,
    });

    return { bookmarked: true };
  }
}

export class RemovePersonBookmarkUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: ToggleInput): Promise<{ bookmarked: false }> {
    await assertVisibleDoctor(this.deps, input);

    await this.deps.personBookmarkRepository.remove({
      userId: input.userId,
      personId: input.personId,
    });

    return { bookmarked: false };
  }
}

/**
 * Saved doctors, newest first, in the same shape the professionals list
 * returns — hydrated through `findAllByIds` so these cards cannot drift from
 * the cards in Explore. Bookmark order is restored after hydration.
 */
export class ListPersonBookmarksUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: {
    userId: number;
    scope: ScopeContext;
    page: number;
    limit: number;
  }) {
    const { items, total } =
      await this.deps.personBookmarkRepository.listForUser({
        userId: input.userId,
        scope: input.scope,
        page: input.page,
        limit: input.limit,
      });

    if (items.length === 0) {
      return {
        data: [],
        pagination: paginationOf(input.page, input.limit, total),
      };
    }

    const ids = items.map((item) => item.personId);
    const professionals =
      await this.deps.healthcareProfessionalRepository.findAllByIds({
        ids,
        scope: input.scope.isGlobal
          ? { isGlobal: true }
          : { isGlobal: false, facilityIds: input.scope.facilityIds },
      });

    const byId = new Map(professionals.map((p) => [p.id, p]));
    /**
     * `{ data, pagination }` — the envelope every other list endpoint uses and
     * the one `PaginatedProfessionals` in the app parses.
     */
    return {
      data: ids.flatMap((id) => {
        const record = byId.get(id);
        return record ? [serializeSummary(record)] : [];
      }),
      pagination: paginationOf(input.page, input.limit, total),
    };
  }
}
