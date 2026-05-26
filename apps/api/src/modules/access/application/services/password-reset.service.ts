import { generateRandomToken } from "../../../../shared/utils/generate-random-token";
import { hashToken } from "../../../../shared/utils/hash-token";
import {
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
} from "../../../../shared/errors";

import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";

interface Dependencies {
  passwordResetRepository: PasswordResetRepository;
}

interface CreatePasswordResetParams {
  userId: string;
}

export class PasswordResetService {
  constructor(private readonly deps: Dependencies) {}

  async createPasswordReset(params: CreatePasswordResetParams) {
    await this.deps.passwordResetRepository.invalidateUnusedForUser(params.userId);

    const token = generateRandomToken();
    const tokenHash = hashToken(token);

    const passwordReset = await this.deps.passwordResetRepository.create({
      userId: params.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    return {
      passwordReset,
      token,
    };
  }

  async validatePasswordResetToken(token: string) {
    const tokenHash = hashToken(token);

    const passwordReset = await this.deps.passwordResetRepository.findByToken({
      tokenHash,
    });

    if (!passwordReset) {
      throw new ResetTokenInvalidError();
    }

    if (passwordReset.usedAt) {
      throw new ResetTokenUsedError();
    }

    if (passwordReset.expiresAt < new Date()) {
      throw new ResetTokenExpiredError();
    }

    return passwordReset;
  }
}
