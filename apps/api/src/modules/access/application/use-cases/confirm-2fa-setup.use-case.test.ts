import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Confirm2FASetupUseCase } from "./confirm-2fa-setup.use-case";
import { createMockUserRepository, createMockAuthCache } from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import {
  InvalidCredentialsError,
  OperationNotAllowedError,
  UserNotFoundError,
  ValidationError,
} from "../../../../shared/errors";

describe("Confirm2FASetupUseCase", () => {
  let useCase: Confirm2FASetupUseCase;
  let mockTwoFactorService: Record<string, ReturnType<typeof mock>>;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;

  const mockUser = {
    id: "user-123",
    twoFactorEnabled: false,
  };

  beforeEach(() => {
    mockAuditLog = createMockAuditLogService();
    mockTwoFactorService = {
      getPendingSetup: mock(async () => "plain-secret"),
      verifyTotp: mock(async () => true),
      encryptSecret: mock(() => "encrypted-secret"),
      clearPendingSetup: mock(async () => {}),
    };

    useCase = new Confirm2FASetupUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => mockUser),
        enableTwoFactor: mock(async () => {}),
      }),
      twoFactorService: mockTwoFactorService as any,
      authCache: createMockAuthCache(),
      auditLog: mockAuditLog,
    });
  });

  it("should enable 2FA with valid code", async () => {
    const result = await useCase.execute({ userId: "user-123", code: "123456" });

    expect(result.success).toBe(true);
    expect(mockAuditLog.log2FAEnable).toHaveBeenCalledTimes(1);
  });

  it("should reject invalid TOTP code", async () => {
    mockTwoFactorService.verifyTotp = mock(async () => false);

    await expect(
      useCase.execute({ userId: "user-123", code: "000000" })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should reject when setup expired", async () => {
    mockTwoFactorService.getPendingSetup = mock(async () => null);

    await expect(
      useCase.execute({ userId: "user-123", code: "123456" })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject when already enabled", async () => {
    useCase = new Confirm2FASetupUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({ ...mockUser, twoFactorEnabled: true })),
      }),
      twoFactorService: mockTwoFactorService as any,
      authCache: createMockAuthCache(),
      auditLog: mockAuditLog,
    });

    await expect(
      useCase.execute({ userId: "user-123", code: "123456" })
    ).rejects.toThrow(OperationNotAllowedError);
  });

  it("should reject when user not found", async () => {
    useCase = new Confirm2FASetupUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => null),
      }),
      twoFactorService: mockTwoFactorService as any,
      authCache: createMockAuthCache(),
      auditLog: mockAuditLog,
    });

    await expect(
      useCase.execute({ userId: "missing", code: "123456" })
    ).rejects.toThrow(UserNotFoundError);
  });
});
