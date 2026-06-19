import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import {
  UserNotFoundError,
  OperationNotAllowedError,
} from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
  auditLog: IAuditLog;
}

export class ActivateUserUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { userId: string; activatedBy: string }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    if (user.status === "ACTIVE") {
      throw new OperationNotAllowedError("activate_user", "User is already active");
    }

    const oldStatus = user.status;

    await this.deps.userRepository.activate(params.userId);

    await this.deps.authCache.invalidate(params.userId);

    await this.deps.auditLog.logUserStatusChange({
      userId: params.activatedBy,
      targetUserId: params.userId,
      oldStatus,
      newStatus: "ACTIVE",
    });
  }
}
