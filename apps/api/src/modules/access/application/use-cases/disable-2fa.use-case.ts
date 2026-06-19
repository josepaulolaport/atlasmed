import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { TwoFactorService } from "../services/two-factor.service";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import type { PasswordService } from "../services/password.service";
import {
  InvalidCredentialsError,
  OperationNotAllowedError,
  UserNotFoundError,
} from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  twoFactorService: TwoFactorService;
  authCache: IAuthCache;
  passwordService: PasswordService;
  auditLog: IAuditLog;
}

export class Disable2FAUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    userId: string;
    password: string;
    code: string;
    ipAddress?: string;
  }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new OperationNotAllowedError("disable_2fa", "Two-factor authentication is not enabled");
    }

    const validPassword = await this.deps.passwordService.verify(
      params.password,
      user.passwordHash
    );

    if (!validPassword) {
      throw new InvalidCredentialsError();
    }

    const secret = this.deps.twoFactorService.decryptSecret(user.twoFactorSecret);
    const validCode = await this.deps.twoFactorService.verifyTotp(params.code, secret);

    if (!validCode) {
      throw new InvalidCredentialsError();
    }

    await this.deps.userRepository.disableTwoFactor(params.userId);
    await this.deps.twoFactorService.clearPendingSetup(params.userId);
    await this.deps.authCache.invalidate(params.userId);

    await this.deps.auditLog.log2FADisable({
      userId: params.userId,
      ipAddress: params.ipAddress,
    });

    return { success: true };
  }
}
