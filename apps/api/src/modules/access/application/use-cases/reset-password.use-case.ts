import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { PasswordService } from "../services/password.service";
import type { NotificationService } from "../services/notification.service";
import { hashToken } from "../../../../shared/utils/hash-token";
import {
  InvalidPasswordError,
  PasswordReuseError,
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
} from "../../../../shared/errors";
import { validatePassword } from "@atlasmed/access";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import type { IMetrics } from "../interfaces/metrics.interface";

interface Dependencies {
  userRepository: UserRepository;
  passwordResetRepository: PasswordResetRepository;
  authCache: IAuthCache;
  sessionCache: ISessionCache;
  passwordService: PasswordService;
  notificationService: NotificationService;
  auditLog: IAuditLog;
  metrics: IMetrics;
}

interface ResetPasswordParams {
  token: string;
  newPassword: string;
  ipAddress?: string | undefined;
}

export class ResetPasswordUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: ResetPasswordParams) {
    const passwordCheck = validatePassword(params.newPassword);
    if (!passwordCheck.valid) {
      throw new InvalidPasswordError([...passwordCheck.errors]);
    }

    const tokenHash = hashToken(params.token);
    const passwordReset = await this.deps.passwordResetRepository.findByToken({ tokenHash });

    if (!passwordReset) {
      throw new ResetTokenInvalidError();
    }

    if (passwordReset.usedAt) {
      throw new ResetTokenUsedError();
    }

    if (passwordReset.expiresAt < new Date()) {
      throw new ResetTokenExpiredError();
    }

    const user = passwordReset.user;
    if (await this.isPasswordReused(params.newPassword, user.passwordHash, user.passwordHistory)) {
      throw new PasswordReuseError();
    }

    const passwordHash = await this.deps.passwordService.hash(params.newPassword);

    const result = await this.deps.userRepository.resetPasswordTransaction({
      tokenHash,
      newPasswordHash: passwordHash,
    });

    await this.deps.authCache.invalidate(result.user.id);
    await this.deps.sessionCache.invalidateByUserId(result.user.id);

    await this.deps.notificationService.sendPasswordChangedNotification({
      email: result.user.email,
      phoneNumber: result.user.phoneNumber || undefined,
      timestamp: new Date(),
      ipAddress: params.ipAddress,
    });

    await this.deps.auditLog.logPasswordChange({
      userId: result.user.id,
      method: "reset",
      ipAddress: params.ipAddress,
    });

    this.deps.metrics.recordPasswordReset("complete");

    return {
      success: true,
    };
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
