import { beforeEach, describe, expect, it, mock } from "bun:test";
import { hash } from "argon2";
import { Disable2FAUseCase } from "./disable-2fa.use-case";
import {
  createMockUserRepository,
  createMockAuthCache,
  createMockSessionCache,
} from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { PasswordService } from "../services/password.service";
import {
  InvalidCredentialsError,
  OperationNotAllowedError,
  UserNotFoundError,
} from "../../../../shared/errors";

describe("Disable2FAUseCase", () => {
  let useCase: Disable2FAUseCase;
  let mockTwoFactorService: Record<string, ReturnType<typeof mock>>;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;
  let mockAuthCache: ReturnType<typeof createMockAuthCache>;
  let mockSessionCache: ReturnType<typeof createMockSessionCache>;
  let mockRevokeAllByUserId: ReturnType<typeof mock>;
  let passwordHash: string;

  const baseUser = {
    id: "user-123",
    twoFactorEnabled: true,
    twoFactorSecret: "encrypted-secret",
    get passwordHash() {
      return passwordHash;
    },
  };

  beforeEach(async () => {
    passwordHash = await hash("CorrectPassword1!");
    mockAuditLog = createMockAuditLogService();
    mockAuthCache = createMockAuthCache();
    mockSessionCache = createMockSessionCache();
    mockRevokeAllByUserId = mock(async () => {});
    mockTwoFactorService = {
      decryptSecret: mock(() => "plain-secret"),
      verifyTotp: mock(async () => true),
      clearPendingSetup: mock(async () => {}),
    };

    useCase = new Disable2FAUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => baseUser),
        disableTwoFactor: mock(async () => {}),
      }),
      twoFactorService: mockTwoFactorService as any,
      authCache: mockAuthCache,
      sessionService: {
        revokeAllByUserId: mockRevokeAllByUserId,
      } as any,
      sessionCache: mockSessionCache,
      passwordService: new PasswordService(),
      auditLog: mockAuditLog,
    });
  });

  it("should disable 2FA with valid password and code", async () => {
    const result = await useCase.execute({
      userId: "user-123",
      password: "CorrectPassword1!",
      code: "123456",
      sessionId: "session-current",
    });

    expect(result.success).toBe(true);
    expect(mockAuditLog.log2FADisable).toHaveBeenCalledTimes(1);
    expect(mockAuthCache.invalidate).toHaveBeenCalledWith("user-123");
    expect(mockRevokeAllByUserId).toHaveBeenCalledWith(
      "user-123",
      "session-current"
    );
    expect(mockSessionCache.invalidateByUserId).toHaveBeenCalledWith(
      "user-123",
      "session-current"
    );
  });

  it("should reject invalid password", async () => {
    await expect(
      useCase.execute({
        userId: "user-123",
        password: "WrongPassword1!",
        code: "123456",
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should reject invalid TOTP code", async () => {
    mockTwoFactorService.verifyTotp = mock(async () => false);

    await expect(
      useCase.execute({
        userId: "user-123",
        password: "CorrectPassword1!",
        code: "000000",
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should reject when 2FA is not enabled", async () => {
    useCase = new Disable2FAUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => ({
          ...baseUser,
          twoFactorEnabled: false,
          twoFactorSecret: null,
        })),
      }),
      twoFactorService: mockTwoFactorService as any,
      authCache: mockAuthCache,
      sessionService: {
        revokeAllByUserId: mockRevokeAllByUserId,
      } as any,
      sessionCache: mockSessionCache,
      passwordService: new PasswordService(),
      auditLog: mockAuditLog,
    });

    await expect(
      useCase.execute({
        userId: "user-123",
        password: "CorrectPassword1!",
        code: "123456",
      })
    ).rejects.toThrow(OperationNotAllowedError);
  });

  it("should reject when user not found", async () => {
    useCase = new Disable2FAUseCase({
      userRepository: createMockUserRepository({
        findById: mock(async () => null),
      }),
      twoFactorService: mockTwoFactorService as any,
      authCache: mockAuthCache,
      sessionService: {
        revokeAllByUserId: mockRevokeAllByUserId,
      } as any,
      sessionCache: mockSessionCache,
      passwordService: new PasswordService(),
      auditLog: mockAuditLog,
    });

    await expect(
      useCase.execute({
        userId: "missing",
        password: "CorrectPassword1!",
        code: "123456",
      })
    ).rejects.toThrow(UserNotFoundError);
  });
});
