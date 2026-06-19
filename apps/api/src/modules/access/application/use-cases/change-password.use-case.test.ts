import { beforeEach, describe, expect, it, mock } from "bun:test";
import { hash } from "argon2";
import { ChangePasswordUseCase } from "./change-password.use-case";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { IAuthCache } from "../interfaces/auth-cache.interface";
import type { ISessionCache } from "../interfaces/session-cache.interface";
import {
  createMockUserRepository,
  createMockAuthCache,
  createMockSessionCache,
} from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { PasswordService } from "../services/password.service";
import {
  InvalidCredentialsError,
  InvalidPasswordError,
  PasswordReuseError,
  UserNotFoundError,
} from "../../../../shared/errors";

describe("ChangePasswordUseCase", () => {
  let useCase: ChangePasswordUseCase;
  let mockUserRepository: UserRepository;
  let mockAuthCache: IAuthCache;
  let mockSessionCache: ISessionCache;
  let mockAuditLog: ReturnType<typeof createMockAuditLogService>;
  let currentPasswordHash: string;

  const mockUser = {
    id: "user-123",
    get passwordHash() {
      return currentPasswordHash;
    },
    passwordHistory: [] as string[],
  };

  beforeEach(async () => {
    currentPasswordHash = await hash("CurrentPassword1!");
    mockAuditLog = createMockAuditLogService();
    mockUserRepository = createMockUserRepository({
      findById: mock(async () => mockUser),
      changePasswordTransaction: mock(async () => ({ user: { id: "user-123" } })),
    });
    mockAuthCache = createMockAuthCache();
    mockSessionCache = createMockSessionCache();

    useCase = new ChangePasswordUseCase({
      userRepository: mockUserRepository,
      authCache: mockAuthCache,
      sessionCache: mockSessionCache,
      passwordService: new PasswordService(),
      auditLog: mockAuditLog,
    });
  });

  it("should change password with valid credentials", async () => {
    const result = await useCase.execute({
      userId: "user-123",
      currentPassword: "CurrentPassword1!",
      newPassword: "NewPassword1!",
    });

    expect(result).toEqual({ success: true });
    expect(mockUserRepository.changePasswordTransaction).toHaveBeenCalled();
    expect(mockAuthCache.invalidate).toHaveBeenCalledWith("user-123");
    expect(mockAuditLog.logPasswordChange).toHaveBeenCalled();
  });

  it("should invalidate other sessions by default when changing password", async () => {
    await useCase.execute({
      userId: "user-123",
      currentPassword: "CurrentPassword1!",
      newPassword: "NewPassword1!",
      sessionId: "session-123",
    });

    expect(mockUserRepository.changePasswordTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        revokeOtherSessions: true,
        keepSessionId: "session-123",
      })
    );
    expect(mockSessionCache.invalidateByUserId).toHaveBeenCalledWith(
      "user-123",
      "session-123"
    );
  });

  it("should invalidate other sessions when revokeOtherSessions is true", async () => {
    await useCase.execute({
      userId: "user-123",
      currentPassword: "CurrentPassword1!",
      newPassword: "NewPassword1!",
      revokeOtherSessions: true,
      sessionId: "session-123",
    });

    expect(mockSessionCache.invalidateByUserId).toHaveBeenCalledWith(
      "user-123",
      "session-123"
    );
  });

  it("should throw when user not found", async () => {
    mockUserRepository.findById = mock(async () => null);

    await expect(
      useCase.execute({
        userId: "missing",
        currentPassword: "CurrentPassword1!",
        newPassword: "NewPassword1!",
      })
    ).rejects.toThrow(UserNotFoundError);
  });

  it("should throw when current password is wrong", async () => {
    await expect(
      useCase.execute({
        userId: "user-123",
        currentPassword: "WrongPassword1!",
        newPassword: "NewPassword1!",
      })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should throw when new password fails validation", async () => {
    await expect(
      useCase.execute({
        userId: "user-123",
        currentPassword: "CurrentPassword1!",
        newPassword: "short",
      })
    ).rejects.toThrow(InvalidPasswordError);
  });

  it("should throw when new password matches current password", async () => {
    await expect(
      useCase.execute({
        userId: "user-123",
        currentPassword: "CurrentPassword1!",
        newPassword: "CurrentPassword1!",
      })
    ).rejects.toThrow(PasswordReuseError);
  });
});
