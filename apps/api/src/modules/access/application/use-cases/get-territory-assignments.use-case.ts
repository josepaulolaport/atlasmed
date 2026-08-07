import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import { ResourceNotFoundError } from "../../../../shared/errors";

export interface TerritoryAssignmentRepositoryPort {
  findById(id: number): Promise<{ id: number } | null>;
}

interface GetTerritoryAssignmentsDependencies {
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  territoryRepository: TerritoryAssignmentRepositoryPort;
}

export interface TerritoryAssignmentEntry {
  userId: number;
  username: string;
  email: string | null;
  firstName?: string;
  lastName?: string;
  avatarUrl: string | null;
  role: { id: number; name: string };
  assignedAt: string;
}

/**
 * Reverse lookup of `GetUserAssignmentsUseCase` — who is assigned to a given
 * territory. Assignment mutations are user-centric (`/access/users/:id/territories`);
 * this reads the same `user_territory_assignments` join table from the territory side.
 */
export class GetTerritoryAssignmentsUseCase {
  constructor(private readonly deps: GetTerritoryAssignmentsDependencies) {}

  async execute(territoryId: number): Promise<TerritoryAssignmentEntry[]> {
    const territory = await this.deps.territoryRepository.findById(territoryId);
    if (!territory) {
      throw new ResourceNotFoundError("Territory", territoryId);
    }

    const assignments = await this.deps.scopeRepository.findUserIdsByTerritoryId(territoryId);

    const entries = await Promise.all(
      assignments.map(async (assignment) => {
        const user = await this.deps.userRepository.findById(assignment.userId);
        if (!user) {
          return null;
        }
        return {
          userId: user.id,
          username: user.username,
          email: user.email,
          ...(user.firstName ? { firstName: user.firstName } : {}),
          ...(user.lastName ? { lastName: user.lastName } : {}),
          avatarUrl: user.avatarUrl,
          role: { id: user.role.id, name: user.role.name },
          assignedAt: assignment.assignedAt.toISOString(),
        };
      })
    );

    return entries.filter((entry): entry is TerritoryAssignmentEntry => entry !== null);
  }
}
