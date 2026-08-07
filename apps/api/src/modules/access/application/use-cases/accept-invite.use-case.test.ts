import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AcceptInviteUseCase } from "./accept-invite.use-case";
import { InvalidInviteError, ValidationError } from "../../../../shared/errors";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { createMockInviteRepository } from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { PasswordService } from "../services/password.service";

describe("AcceptInviteUseCase", () => {
  let acceptInviteUseCase: AcceptInviteUseCase;
  let mockInviteRepository: InviteRepository;

  const mockInvite = {
    id: 123,
    email: "newuser@example.com",
    phoneNumber: null,
    tokenHash: "hashed-token",
    roleId: 1,
    invitedByUserId: 456,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "PENDING",
    firstName: "Test",
    lastName: "User",
    birthDate: new Date("1990-05-12T00:00:00.000Z"),
    managerTerritoryId: null,
    repTerritoryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    acceptedAt: null,
    acceptedByUserId: null,
    revokedAt: null,
    resendCount: 0,
    lastResendAt: null,
    role: {
      id: 1,
      name: "USER",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockUser = {
    id: 123,
    email: "newuser@example.com",
    username: "newusername",
    phoneNumber: null,
    passwordHash: "$argon2id$test",
    roleId: 1,
    firstName: "Test",
    lastName: "User",
    status: "ACTIVE",
    emailVerified: true,
    phoneVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deactivatedAt: null,
    role: mockInvite.role,
  };

  const baseParams = {
    token: "valid-token",
    email: "newuser@example.com",
    username: "newusername",
    password: "SecurePass1!",
    firstName: "Test",
    lastName: "User",
    birthDate: "1990-05-12",
  };

  beforeEach(() => {
    mockInviteRepository = createMockInviteRepository({
      findValidByTokenHash: mock(async () => mockInvite) as any,
      acceptInviteTransaction: mock(async () => ({
        user: mockUser,
        invite: mockInvite,
      })) as any,
    });

    acceptInviteUseCase = new AcceptInviteUseCase({
      inviteRepository: mockInviteRepository,
      passwordService: new PasswordService(),
      auditLog: createMockAuditLogService(),
    });
  });

  describe("valid invite acceptance", () => {
    it("should accept valid invite", async () => {
      const result = await acceptInviteUseCase.execute(baseParams);

      expect(result).toBeDefined();
      expect(result.id).toBe(123);
    });

    it("should call acceptInviteTransaction with hashed password and birthDate", async () => {
      await acceptInviteUseCase.execute(baseParams);

      expect(mockInviteRepository.acceptInviteTransaction).toHaveBeenCalledTimes(1);
      const callArgs = (mockInviteRepository.acceptInviteTransaction as any).mock.calls[0][0];
      expect(callArgs.email).toBe("newuser@example.com");
      expect(callArgs.username).toBe("newusername");
      expect(callArgs.passwordHash).toStartWith("$argon2id");
      expect(callArgs.birthDate.toISOString().slice(0, 10)).toBe("1990-05-12");
    });

    it("should allow fuzzy name confirmation", async () => {
      await acceptInviteUseCase.execute({
        ...baseParams,
        firstName: "Test",
        lastName: "User Silva",
      });

      expect(mockInviteRepository.acceptInviteTransaction).toHaveBeenCalled();
    });
  });

  describe("identity confirmation", () => {
    it("should reject mismatched birth date", async () => {
      await expect(
        acceptInviteUseCase.execute({
          ...baseParams,
          birthDate: "1991-01-01",
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("should reject mismatched name", async () => {
      await expect(
        acceptInviteUseCase.execute({
          ...baseParams,
          firstName: "Maria",
          lastName: "Silva",
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("invalid invite", () => {
    it("should throw when invite is missing", async () => {
      mockInviteRepository = createMockInviteRepository({
        findValidByTokenHash: mock(async () => null) as any,
      });
      acceptInviteUseCase = new AcceptInviteUseCase({
        inviteRepository: mockInviteRepository,
        passwordService: new PasswordService(),
        auditLog: createMockAuditLogService(),
      });

      await expect(acceptInviteUseCase.execute(baseParams)).rejects.toBeInstanceOf(
        InvalidInviteError,
      );
    });
  });
});
