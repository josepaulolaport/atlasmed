import { Role } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import type { ScopeService } from "../services/scope.service";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import {
  UserNotFoundError,
  InsufficientPermissionsError,
  OperationNotAllowedError,
} from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  scopeService: ScopeService;
}

export class AssignUserTerritoryUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    targetUserId: string;
    territoryId: string;
    assignedBy: string;
    actorRole: Role;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["user:assign_territory"],
        [`role:${params.actorRole}`]
      );
    }

    const target = await this.deps.userRepository.findById(params.targetUserId);

    if (!target) {
      throw new UserNotFoundError(params.targetUserId);
    }

    if (target.role.name !== Role.USER) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "Territory assignments are only supported for USER accounts"
      );
    }

    await this.deps.scopeRepository.assignTerritory({
      userId: params.targetUserId,
      territoryId: params.territoryId,
      assignedBy: params.assignedBy,
    });

    await this.deps.scopeService.invalidateForTerritoryAssignmentChange(params.targetUserId);

    await auditLogService.log({
      userId: params.assignedBy,
      eventType: "USER_TERRITORY_ASSIGNED",
      severity: "INFO",
      action: "assign_territory",
      resource: "user",
      resourceId: params.targetUserId,
      actorId: params.assignedBy,
      details: {
        targetUserId: params.targetUserId,
        territoryId: params.territoryId,
      },
    });
  }
}
