import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { TwoFactorService } from "../services/two-factor.service";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import {
  InvalidCredentialsError,
  OperationNotAllowedError,
  UserNotFoundError,
  ValidationError,
} from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  twoFactorService: TwoFactorService;
  authCache: IAuthCache;
  auditLog: IAuditLog;
}

export class Confirm2FASetupUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    userId: string;
    code: string;
    ipAddress?: string;
  }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    if (user.twoFactorEnabled) {
      throw new OperationNotAllowedError("confirm_2fa_setup", "Two-factor authentication is already enabled");
    }

    const pendingSecret = await this.deps.twoFactorService.getPendingSetup(params.userId);

    if (!pendingSecret) {
      throw new ValidationError([
        { field: "code", message: "2FA setup has expired. Please start setup again." },
      ]);
    }

    const valid = await this.deps.twoFactorService.verifyTotp(params.code, pendingSecret);

    if (!valid) {
      throw new InvalidCredentialsError();
    }

    const encryptedSecret = this.deps.twoFactorService.encryptSecret(pendingSecret);

    await this.deps.userRepository.enableTwoFactor({
      userId: params.userId,
      encryptedSecret,
    });

    await this.deps.twoFactorService.clearPendingSetup(params.userId);
    await this.deps.authCache.invalidate(params.userId);

    await this.deps.auditLog.log2FAEnable({
      userId: params.userId,
      ipAddress: params.ipAddress,
    });

    return { success: true };
  }
}
