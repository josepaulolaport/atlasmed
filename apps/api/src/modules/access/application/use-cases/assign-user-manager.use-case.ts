import { Role } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { ScopeRepository } from "../interfaces/scope.repository.interface";
import type { ScopeService } from "../services/scope.service";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import {
  UserNotFoundError,
  OperationNotAllowedError,
  InsufficientPermissionsError,
} from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  scopeRepository: ScopeRepository;
  scopeService: ScopeService;
  auditLog: IAuditLog;
}

export class AssignUserManagerUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    targetUserId: string;
    managerId: string | null;
    assignedBy: string;
    actorRole: Role;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["user:assign_manager"],
        [`role:${params.actorRole}`]
      );
    }

    const target = await this.deps.userRepository.findById(params.targetUserId);

    if (!target) {
      throw new UserNotFoundError(params.targetUserId);
    }

    if (params.targetUserId === params.managerId) {
      throw new OperationNotAllowedError(
        "assign_manager",
        "A user cannot manage themselves"
      );
    }

    let nextManagerId: string | null = null;

    if (params.managerId) {
      const manager = await this.deps.userRepository.findById(params.managerId);

      if (!manager) {
        throw new UserNotFoundError(params.managerId);
      }

      if (manager.role.name !== Role.MANAGER && manager.role.name !== Role.ADMIN) {
        throw new OperationNotAllowedError(
          "assign_manager",
          "Manager must have MANAGER or ADMIN role"
        );
      }

      nextManagerId = params.managerId;
    }

    const previousManagerId = target.managerId ?? null;

    await this.deps.userRepository.updateManagerId(params.targetUserId, nextManagerId);

    await this.deps.scopeService.invalidateForManagerChange({
      userId: params.targetUserId,
      previousManagerId,
      nextManagerId,
    });

    await this.deps.auditLog.log({
      userId: params.assignedBy,
      eventType: nextManagerId ? "USER_MANAGER_ASSIGNED" : "USER_MANAGER_REMOVED",
      severity: "INFO",
      action: nextManagerId ? "assign_manager" : "remove_manager",
      resource: "user",
      resourceId: params.targetUserId,
      actorId: params.assignedBy,
      details: {
        targetUserId: params.targetUserId,
        previousManagerId,
        nextManagerId,
      },
    });
  }
}
