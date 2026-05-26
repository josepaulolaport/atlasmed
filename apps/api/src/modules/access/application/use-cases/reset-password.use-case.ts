import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import { PasswordService } from "../services/password.service";
import { NotificationService } from "../services/notification.service";
import { hashToken } from "../../../../shared/utils/hash-token";
import {
  InvalidPasswordError,
  PasswordReuseError,
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
} from "../../../../shared/errors";
import { validatePassword } from "@atlasmed/access";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";

interface Dependencies {
  userRepository: UserRepository;
  passwordResetRepository: PasswordResetRepository;
  authCache: IAuthCache;
  sessionCache: ISessionCache;
}

interface ResetPasswordParams {
  token: string;
  newPassword: string;
  ipAddress?: string | undefined;
}

export class ResetPasswordUseCase {
  private readonly passwordService: PasswordService;
  private readonly notificationService: NotificationService;

  constructor(private readonly deps: Dependencies) {
    this.passwordService = new PasswordService();
    this.notificationService = new NotificationService();
  }

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

    const passwordHash = await this.passwordService.hash(params.newPassword);

    const result = await this.deps.userRepository.resetPasswordTransaction({
      tokenHash,
      newPassword: params.newPassword,
      newPasswordHash: passwordHash,
    });

    await this.deps.authCache.invalidate(result.user.id);
    await this.deps.sessionCache.invalidateByUserId(result.user.id);

    await this.notificationService.sendPasswordChangedNotification({
      email: result.user.email,
      phoneNumber: result.user.phoneNumber || undefined,
      timestamp: new Date(),
      ipAddress: params.ipAddress,
    });

    await auditLogService.logPasswordChange({
      userId: result.user.id,
      method: "reset",
      ipAddress: params.ipAddress,
    });

    return {
      success: true,
    };
  }

  private async isPasswordReused(
    password: string,
    currentHash: string,
    passwordHistory: string[]
  ): Promise<boolean> {
    if (await this.passwordService.verify(password, currentHash)) {
      return true;
    }

    for (const historicHash of passwordHistory) {
      if (await this.passwordService.verify(password, historicHash)) {
        return true;
      }
    }

    return false;
  }
}
