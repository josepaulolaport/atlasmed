import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Setup2FAUseCase } from "./setup-2fa.use-case";
import { createMockUserRepository } from "../../test-helpers/fixtures";
import { OperationNotAllowedError, UserNotFoundError } from "../../../../shared/errors";

describe("Setup2FAUseCase", () => {
  let useCase: Setup2FAUseCase;
  let mockTwoFactorService: {
    generateSecret: ReturnType<typeof mock>;
    storePendingSetup: ReturnType<typeof mock>;
    generateOtpAuthUrl: ReturnType<typeof mock>;
  };

  const mockUser = {
    id: "user-123",
    email: "user@example.com",
    twoFactorEnabled: false,
  };

  beforeEach(() => {
    mockTwoFactorService = {
      generateSecret: mock(() => "BASE32SECRET"),
      storePendingSetup: mock(async () => {}),
      generateOtpAuthUrl: mock(() => "otpauth://totp/AtlasMed:user@example.com?secret=BASE32SECRET"),
    };

    useCase = new Setup2FAUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => mockUser),
      }),
      twoFactorService: mockTwoFactorService as any,
    });
  });

  it("should return secret and otpauth URL", async () => {
    const result = await useCase.execute({ userId: "user-123" });

    expect(result.secret).toBe("BASE32SECRET");
    expect(result.otpauthUrl).toContain("otpauth://");
    expect(mockTwoFactorService.storePendingSetup).toHaveBeenCalledWith(
      "user-123",
      "BASE32SECRET"
    );
  });

  it("should reject when 2FA is already enabled", async () => {
    useCase = new Setup2FAUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({ ...mockUser, twoFactorEnabled: true })),
      }),
      twoFactorService: mockTwoFactorService as any,
    });

    await expect(useCase.execute({ userId: "user-123" })).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  it("should reject when user not found", async () => {
    useCase = new Setup2FAUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => null),
      }),
      twoFactorService: mockTwoFactorService as any,
    });

    await expect(useCase.execute({ userId: "missing" })).rejects.toThrow(UserNotFoundError);
  });
});
