import type { Role, ScopeContext } from "@atlasmed/access";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import { assertCanMutateUser } from "../services/managed-user-authorization.service";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";
import { UserNotFoundError, OperationNotAllowedError } from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
}

export class UnsuspendUserUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    userId: string;
    unsuspendedBy: string;
    actorRole: Role;
    scope: ScopeContext;
  }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    assertCanMutateUser({
      scope: params.scope,
      actorId: params.unsuspendedBy,
      actorRole: params.actorRole,
      target: { id: user.id, managerId: user.managerId },
      action: "unsuspend",
    });

    if (user.status !== "SUSPENDED") {
      throw new OperationNotAllowedError(
        "unsuspend_user",
        "User is not suspended"
      );
    }

    const oldStatus = user.status;

    await this.deps.userRepository.unsuspend(params.userId);

    await this.deps.authCache.invalidate(params.userId);

    await auditLogService.logUserStatusChange({
      userId: params.unsuspendedBy,
      targetUserId: params.userId,
      oldStatus,
      newStatus: "ACTIVE",
    });
  }
}
