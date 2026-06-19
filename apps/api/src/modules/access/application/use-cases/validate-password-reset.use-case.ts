import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import { PasswordResetService } from "../services/password-reset.service";

interface Dependencies {
  passwordResetRepository: PasswordResetRepository;
}

interface ValidatePasswordResetParams {
  token: string;
}

export class ValidatePasswordResetUseCase {
  private readonly passwordResetService: PasswordResetService;

  constructor(deps: Dependencies) {
    this.passwordResetService = new PasswordResetService({
      passwordResetRepository: deps.passwordResetRepository,
    });
  }

  async execute(params: ValidatePasswordResetParams) {
    await this.passwordResetService.validatePasswordResetToken(params.token);
    return { valid: true as const };
  }
}
