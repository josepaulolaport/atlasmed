import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import { PasswordService } from "../services/password.service";
import {
  InvalidCredentialsError,
  InvalidPasswordError,
  PasswordReuseError,
  UserNotFoundError,
} from "../../../../shared/errors";
import { validatePassword } from "@atlasmed/access";
import { PASSWORD_HISTORY_LIMIT } from "../constants/password.constants";

interface Dependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
  sessionCache: ISessionCache;
  passwordService: PasswordService;
  auditLog: IAuditLog;
}

interface ChangePasswordParams {
  userId: string;
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class ChangePasswordUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: ChangePasswordParams) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    const validCurrentPassword = await this.deps.passwordService.verify(
      params.currentPassword,
      user.passwordHash
    );

    if (!validCurrentPassword) {
      throw new InvalidCredentialsError();
    }

    const passwordCheck = validatePassword(params.newPassword);
    if (!passwordCheck.valid) {
      throw new InvalidPasswordError([...passwordCheck.errors]);
    }

    if (
      await this.isPasswordReused(
        params.newPassword,
        user.passwordHash,
        user.passwordHistory ?? []
      )
    ) {
      throw new PasswordReuseError();
    }

    const newPasswordHash = await this.deps.passwordService.hash(params.newPassword);
    const passwordHistory = [user.passwordHash, ...(user.passwordHistory ?? [])].slice(
      0,
      PASSWORD_HISTORY_LIMIT
    );

    const revokeOtherSessions = params.revokeOtherSessions ?? true;

    const result = await this.deps.userRepository.changePasswordTransaction({
      userId: params.userId,
      newPasswordHash,
      previousPasswordHash: user.passwordHash,
      passwordHistory,
      revokeOtherSessions,
      keepSessionId: revokeOtherSessions ? params.sessionId : undefined,
    });

    await this.deps.authCache.invalidate(params.userId);

    if (revokeOtherSessions) {
      await this.deps.sessionCache.invalidateByUserId(
        params.userId,
        params.sessionId
      );
    }

    await this.deps.auditLog.logPasswordChange({
      userId: result.user.id,
      method: "change",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return { success: true };
  }

  private async isPasswordReused(
    password: string,
    currentHash: string,
    passwordHistory: string[]
  ): Promise<boolean> {
    if (await this.deps.passwordService.verify(password, currentHash)) {
      return true;
    }

    for (const historicHash of passwordHistory) {
      if (await this.deps.passwordService.verify(password, historicHash)) {
        return true;
      }
    }

    return false;
  }
}
