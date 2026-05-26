import type { Role, ScopeContext } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { SessionRepository } from "../interfaces/session.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import { SessionService } from "../services/session.service";
import type { ScopeService } from "../services/scope.service";
import { assertCanMutateUser } from "../services/managed-user-authorization.service";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { metricsService } from "../../../../infrastructure/monitoring/metrics.service";
import { UserNotFoundError, OperationNotAllowedError } from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  authCache: IAuthCache;
  sessionCache: ISessionCache;
  scopeService: ScopeService;
}

export class DeactivateUserUseCase {
  private readonly sessionService: SessionService;

  constructor(private readonly deps: Dependencies) {
    this.sessionService = new SessionService({
      sessionRepository: deps.sessionRepository,
      sessionCache: deps.sessionCache,
    });
  }

  async execute(params: {
    userId: string;
    deactivatedBy: string;
    actorRole: Role;
    scope: ScopeContext;
    reason?: string;
  }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    assertCanMutateUser({
      scope: params.scope,
      actorId: params.deactivatedBy,
      actorRole: params.actorRole,
      target: { id: user.id, managerId: user.managerId },
      action: "deactivate",
    });

    if (user.status === "INACTIVE") {
      throw new OperationNotAllowedError(
        "deactivate_user",
        "User is already deactivated"
      );
    }

    const oldStatus = user.status;

    await this.deps.userRepository.deactivate(params.userId);

    await this.sessionService.revokeAllByUserId(params.userId);

    await this.deps.authCache.invalidate(params.userId);

    if (user.managerId) {
      await this.deps.scopeService.invalidateForManagerChange({
        userId: params.userId,
        previousManagerId: user.managerId,
        nextManagerId: user.managerId,
      });
    } else {
      await this.deps.scopeService.invalidate(params.userId);
    }

    await auditLogService.logUserStatusChange({
      userId: params.deactivatedBy,
      targetUserId: params.userId,
      oldStatus,
      newStatus: "INACTIVE",
      reason: params.reason,
    });

    metricsService.recordSessionRevoked("user_deactivated");
  }
}
