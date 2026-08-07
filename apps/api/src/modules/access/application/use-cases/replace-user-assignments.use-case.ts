import { Role } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import type { InvitationTerritoryValidatorService } from "../services/invitation-territory-validator.service";
import {
  InsufficientPermissionsError,
  UserNotFoundError,
} from "../../../../shared/errors";
import { GetUserAssignmentsUseCase } from "./get-user-assignments.use-case";

interface Dependencies {
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  territoryValidator: InvitationTerritoryValidatorService;
  getUserAssignments: GetUserAssignmentsUseCase;
}

export class ReplaceUserAssignmentsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    targetUserId: number;
    actorUserId: number;
    actorRole: Role;
    verticalAssignments: Array<{
      verticalId: number;
      territoryIds: number[];
    }>;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["user:manage"],
        [`role:${params.actorRole}`],
      );
    }

    const user = await this.deps.userRepository.findById(params.targetUserId);
    if (!user) {
      throw new UserNotFoundError(params.targetUserId);
    }

    const roleName = user.role.name as Role;

    if (params.verticalAssignments.length > 0) {
      await this.deps.territoryValidator.validateInvitationTerritories({
        roleId: user.roleId,
        roleName,
        verticalAssignments: params.verticalAssignments,
      });
    }

    await this.deps.scopeRepository.replaceAssignments({
      userId: params.targetUserId,
      assignedByUserId: params.actorUserId,
      verticalAssignments: params.verticalAssignments,
    });

    return this.deps.getUserAssignments.execute({
      targetUserId: params.targetUserId,
      actorRole: params.actorRole,
    });
  }
}
