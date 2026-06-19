import { beforeEach, describe, expect, it, mock } from "bun:test";
import { hashToken } from "../../../../shared/utils/hash-token";
import type { PasswordResetRepository } from "../interfaces/password-reset.repository.interface";
import {
  ResetTokenExpiredError,
  ResetTokenInvalidError,
} from "../../../../shared/errors";
import { ValidatePasswordResetUseCase } from "./validate-password-reset.use-case";

describe("ValidatePasswordResetUseCase", () => {
  let mockRepository: PasswordResetRepository;
  let useCase: ValidatePasswordResetUseCase;

  beforeEach(() => {
    mockRepository = {
      create: mock(async () => ({} as never)),
      findByToken: mock(async () => null),
      markAsUsed: mock(async () => {}),
      invalidateUnusedForUser: mock(async () => {}),
      deleteExpired: mock(async () => {}),
    };

    useCase = new ValidatePasswordResetUseCase({
      passwordResetRepository: mockRepository,
    });
  });

  it("returns valid for an active token", async () => {
    const token = "valid-reset-token";
    mockRepository.findByToken = mock(async () => ({
      id: "reset-1",
      userId: "user-1",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    }));

    await expect(useCase.execute({ token })).resolves.toEqual({ valid: true });
  });

  it("rejects invalid tokens", async () => {
    await expect(useCase.execute({ token: "bad-token" })).rejects.toThrow(
      ResetTokenInvalidError,
    );
  });

  it("rejects expired tokens", async () => {
    const token = "expired-token";
    mockRepository.findByToken = mock(async () => ({
      id: "reset-1",
      userId: "user-1",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    }));

    await expect(useCase.execute({ token })).rejects.toThrow(
      ResetTokenExpiredError,
    );
  });
});
