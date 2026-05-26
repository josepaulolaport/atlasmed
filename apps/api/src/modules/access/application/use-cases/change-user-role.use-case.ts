import { canChangeUserRole, Role } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { RoleRepository } from "../interfaces/role.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { SessionService } from "../services/session.service";
import type { ScopeService } from "../services/scope.service";
import { canAssignRole } from "../constants/role-priority.constants";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { metricsService } from "../../../../infrastructure/monitoring/metrics.service";
import {
  UserNotFoundError,
  RoleNotFoundError,
  InsufficientPermissionsError,
  OperationNotAllowedError,
} from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  roleRepository: RoleRepository;
  sessionRepository: SessionRepository;
  authCache: IAuthCache;
  sessionCache: ISessionCache;
  scopeService: ScopeService;
}

export class ChangeUserRoleUseCase {
  private readonly sessionService: SessionService;

  constructor(private readonly deps: Dependencies) {
    this.sessionService = new SessionService({
      sessionRepository: deps.sessionRepository,
      sessionCache: deps.sessionCache,
    });
  }

  async execute(params: {
    targetUserId: string;
    newRoleId: string;
    changedBy: string;
  }) {
    const target = await this.deps.userRepository.findById(params.targetUserId);

    if (!target) {
      throw new UserNotFoundError(params.targetUserId);
    }

    const actor = await this.deps.userRepository.findById(params.changedBy);

    if (!actor) {
      throw new UserNotFoundError(params.changedBy);
    }

    if (target.roleId === params.newRoleId) {
      throw new OperationNotAllowedError("change_role", "Role is unchanged");
    }

    const newRole = await this.deps.roleRepository.findById(params.newRoleId);

    if (!newRole) {
      throw new RoleNotFoundError(params.newRoleId);
    }

    const actorRole = actor.role as
      | { name: string; priority?: number | null }
      | undefined;
    const targetRole = target.role as
      | { name: string; priority?: number | null }
      | undefined;

    if (!actorRole?.name || !canAssignRole(actorRole, newRole)) {
      throw new InsufficientPermissionsError(
        [`role:${newRole.name}`],
        [`role:${actorRole?.name ?? "unknown"}`]
      );
    }

    if (!canChangeUserRole(actorRole.name as Role)) {
      throw new InsufficientPermissionsError(
        ["role:change"],
        [`role:${actorRole.name}`]
      );
    }

    if (!targetRole?.name || !canAssignRole(actorRole, targetRole)) {
      throw new InsufficientPermissionsError(
        [`manage:user:${targetRole?.name ?? "unknown"}`],
        [`role:${actorRole?.name ?? "unknown"}`]
      );
    }

    const oldRoleId = target.roleId;

    await this.deps.userRepository.updateRole(params.targetUserId, params.newRoleId);
    await this.deps.userRepository.incrementTokenVersion(params.targetUserId);

    await this.sessionService.revokeAllByUserId(params.targetUserId);

    await this.deps.authCache.invalidate(params.targetUserId);
    await this.deps.scopeService.invalidate(params.targetUserId);

    await auditLogService.logRoleChange({
      userId: params.changedBy,
      targetUserId: params.targetUserId,
      oldRoleId,
      newRoleId: params.newRoleId,
    });

    metricsService.recordSessionRevoked("role_changed");
  }
}
