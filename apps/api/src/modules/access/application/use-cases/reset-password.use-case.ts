import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import { PasswordService } from "../services/password.service";
import { NotificationService } from "../services/notification.service";
import { hashToken } from "../../../../shared/utils/hash-token";

interface Dependencies {
  userRepository: UserRepository;
  authCache: IAuthCache;
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
    const tokenHash = hashToken(params.token);
    const passwordHash = await this.passwordService.hash(params.newPassword);

    const result = await this.deps.userRepository.resetPasswordTransaction({
      tokenHash,
      newPasswordHash: passwordHash,
    });

    await this.deps.authCache.invalidate(result.user.id);

    await this.notificationService.sendPasswordChangedNotification({
      email: result.user.email,
      phoneNumber: result.user.phoneNumber || undefined,
      timestamp: new Date(),
      ipAddress: params.ipAddress,
    });

    return {
      success: true,
    };
  }
}
