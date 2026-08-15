import type { ScopeContext } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import type { RoteiroRepository } from "../interfaces/roteiro.repository.interface";

const MAX_RESULTS = 30;

/**
 * The clinics a rep may add to a roteiro by hand.
 *
 * Their own book for the linha, searchable by name — not the engine's candidate
 * set. A rep adding a clinic knows something the engine does not (a call they
 * took, a doctor expecting them), so the list is not narrowed by reachability
 * or cooldown. Whether the day can *hold* it is generation's problem, and it
 * says so when it cannot.
 */
export class ListAddableClinicsUseCase {
  constructor(private readonly deps: { repository: RoteiroRepository }) {}

  async execute(input: {
    actor: { userId: number; roleName: string };
    scope: ScopeContext;
    subjectUserId?: number;
    verticalId: number;
    query?: string;
    limit?: number;
  }) {
    const subjectUserId = input.subjectUserId ?? input.actor.userId;
    if (subjectUserId !== input.actor.userId) {
      const isAdmin = input.actor.roleName === "ADMIN" && input.scope.isGlobal;
      const managesThem =
        input.actor.roleName === "MANAGER" &&
        input.scope.managedUserIds.includes(subjectUserId);
      if (!isAdmin && !managesThem) {
        throw new ForbiddenError("Roteiro is outside the current owner/team scope");
      }
    }

    const data = await this.deps.repository.searchAddableClinics({
      userId: subjectUserId,
      verticalId: input.verticalId,
      query: input.query?.trim() ? input.query.trim() : null,
      limit: Math.min(input.limit ?? MAX_RESULTS, MAX_RESULTS),
    });
    return { data };
  }
}
