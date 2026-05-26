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

export class RevokeUserTerritoryUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    targetUserId: string;
    territoryId: string;
    revokedBy: string;
    actorRole: Role;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["user:revoke_territory"],
        [`role:${params.actorRole}`]
      );
    }

    const target = await this.deps.userRepository.findById(params.targetUserId);

    if (!target) {
      throw new UserNotFoundError(params.targetUserId);
    }

    if (target.role.name !== Role.USER) {
      throw new OperationNotAllowedError(
        "revoke_territory",
        "Territory assignments are only supported for USER accounts"
      );
    }

    await this.deps.scopeRepository.revokeTerritory({
      userId: params.targetUserId,
      territoryId: params.territoryId,
    });

    await this.deps.scopeService.invalidateForTerritoryAssignmentChange(params.targetUserId);

    await auditLogService.log({
      userId: params.revokedBy,
      eventType: "USER_TERRITORY_REVOKED",
      severity: "INFO",
      action: "revoke_territory",
      resource: "user",
      resourceId: params.targetUserId,
      actorId: params.revokedBy,
      details: {
        targetUserId: params.targetUserId,
        territoryId: params.territoryId,
      },
    });
  }
}
