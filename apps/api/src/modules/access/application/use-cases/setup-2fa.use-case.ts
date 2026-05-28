import type { UserRepository } from "../interfaces/user.repository.interface";
import type { TwoFactorService } from "../services/two-factor.service";
import { OperationNotAllowedError, UserNotFoundError } from "../../../../shared/errors";

interface Dependencies {
  userRepository: UserRepository;
  twoFactorService: TwoFactorService;
}

export class Setup2FAUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: { userId: string }) {
    const user = await this.deps.userRepository.findById(params.userId);

    if (!user) {
      throw new UserNotFoundError(params.userId);
    }

    if (user.twoFactorEnabled) {
      throw new OperationNotAllowedError("setup_2fa", "Two-factor authentication is already enabled");
    }

    const secret = this.deps.twoFactorService.generateSecret();
    await this.deps.twoFactorService.storePendingSetup(params.userId, secret);

    return {
      secret,
      otpauthUrl: this.deps.twoFactorService.generateOtpAuthUrl({
        email: user.email,
        secret,
      }),
    };
  }
}
