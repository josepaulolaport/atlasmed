import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import { PasswordResetService } from "../services/password-reset.service";

interface Dependencies {
  passwordResetRepository: PasswordResetRepository;
}

interface VerifyPasswordResetTokenParams {
  token: string;
}

export class VerifyPasswordResetTokenUseCase {
  private readonly passwordResetService: PasswordResetService;

  constructor(private readonly deps: Dependencies) {
    this.passwordResetService = new PasswordResetService({
      passwordResetRepository: deps.passwordResetRepository,
    });
  }

  async execute(params: VerifyPasswordResetTokenParams) {
    await this.passwordResetService.validatePasswordResetToken(params.token);
    return { valid: true as const };
  }
}
