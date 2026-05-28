import { beforeEach, describe, expect, it, mock } from "bun:test";
import { AcceptInviteUseCase } from "./accept-invite.use-case";
import { InvalidInviteError } from "../../../../shared/errors";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import { createMockInviteRepository } from "../../test-helpers/fixtures";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { PasswordService } from "../services/password.service";

describe("AcceptInviteUseCase", () => {
  let acceptInviteUseCase: AcceptInviteUseCase;
  let mockInviteRepository: InviteRepository;

  const mockInvite = {
    id: "invite-123",
    email: "newuser@example.com",
    phoneNumber: null,
    tokenHash: "hashed-token",
    roleId: "role-123",
    invitedByUserId: "admin-456",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "PENDING",
    createdAt: new Date(),
    acceptedAt: null,
    revokedAt: null,
    role: {
      id: "role-123",
      name: "USER",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockUser = {
    id: "user-123",
    email: "newuser@example.com",
    username: "newusername",
    phoneNumber: null,
    passwordHash: "$argon2id$test",
    roleId: "role-123",
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

  beforeEach(() => {
    mockInviteRepository = createMockInviteRepository({
      acceptInviteTransaction: mock(async () => ({
        user: mockUser,
        invite: mockInvite,
      })),
    });

    acceptInviteUseCase = new AcceptInviteUseCase({
      inviteRepository: mockInviteRepository,
      passwordService: new PasswordService(),
      auditLog: createMockAuditLogService(),
    });
  });

  describe("valid invite acceptance", () => {
    it("should accept valid invite", async () => {
      const params = {
        token: "valid-token",
        email: "newuser@example.com",
        username: "newusername",
        password: "SecurePass1",
        firstName: "Test",
        lastName: "User",
      };

      const result = await acceptInviteUseCase.execute(params);

      expect(result).toBeDefined();
      expect(result.id).toBe("user-123");
    });

    it("should call acceptInviteTransaction with hashed password", async () => {
      await acceptInviteUseCase.execute({
        token: "valid-token",
        email: "newuser@example.com",
        username: "newusername",
        password: "SecurePass1",
      });

      expect(mockInviteRepository.acceptInviteTransaction).toHaveBeenCalledTimes(1);
      const callArgs = (mockInviteRepository.acceptInviteTransaction as any).mock.calls[0][0];
      expect(callArgs.email).toBe("newuser@example.com");
      expect(callArgs.username).toBe("newusername");
      expect(callArgs.passwordHash).toStartWith("$argon2id");
    });

    it("should hash password before calling transaction", async () => {
      await acceptInviteUseCase.execute({
        token: "valid-token",
        email: "newuser@example.com",
        username: "newusername",
        password: "PlainText1",
      });

      const callArgs = (mockInviteRepository.acceptInviteTransaction as any).mock.calls[0][0];
      expect(callArgs.passwordHash).not.toBe("PlainText1");
      expect(callArgs.passwordHash).toStartWith("$argon2id");
    });

    it("should pass firstName to transaction", async () => {
      await acceptInviteUseCase.execute({
        token: "valid-token",
        email: "newuser@example.com",
        username: "newusername",
        password: "SecurePass1",
        firstName: "John",
      });

      const callArgs = (mockInviteRepository.acceptInviteTransaction as any).mock.calls[0][0];
      expect(callArgs.firstName).toBe("John");
    });

    it("should pass lastName to transaction", async () => {
      await acceptInviteUseCase.execute({
        token: "valid-token",
        email: "newuser@example.com",
        username: "newusername",
        password: "SecurePass1",
        lastName: "Doe",
      });

      const callArgs = (mockInviteRepository.acceptInviteTransaction as any).mock.calls[0][0];
      expect(callArgs.lastName).toBe("Doe");
    });

    it("should pass phoneNumber to transaction", async () => {
      await acceptInviteUseCase.execute({
        token: "valid-token",
        email: "newuser@example.com",
        phoneNumber: "+1234567890",
        username: "newusername",
        password: "SecurePass1",
      });

      const callArgs = (mockInviteRepository.acceptInviteTransaction as any).mock.calls[0][0];
      expect(callArgs.phoneNumber).toBe("+1234567890");
    });

    it("should return user from transaction result", async () => {
      const result = await acceptInviteUseCase.execute({
        token: "valid-token",
        email: "newuser@example.com",
        username: "newusername",
        password: "SecurePass1",
      });

      expect(result).toEqual(mockUser);
    });
  });

  describe("invalid invite", () => {
    it("should throw InvalidInviteError when invite not found", async () => {
      mockInviteRepository.acceptInviteTransaction = mock(async () => {
        throw new InvalidInviteError();
      });

      await expect(
        acceptInviteUseCase.execute({
          token: "invalid-token",
          email: "newuser@example.com",
          username: "newusername",
          password: "SecurePass1",
        })
      ).rejects.toThrow(InvalidInviteError);
    });

    it("should throw error when email does not match invite", async () => {
      mockInviteRepository.acceptInviteTransaction = mock(async () => {
        throw new InvalidInviteError("Email does not match invitation");
      });

      await expect(
        acceptInviteUseCase.execute({
          token: "valid-token",
          email: "wrong@example.com",
          username: "newusername",
          password: "SecurePass1",
        })
      ).rejects.toThrow(InvalidInviteError);
    });

    it("should throw error when phone does not match invite", async () => {
      mockInviteRepository.acceptInviteTransaction = mock(async () => {
        throw new InvalidInviteError("Phone number does not match invitation");
      });

      await expect(
        acceptInviteUseCase.execute({
          token: "valid-token",
          email: "user@example.com",
          phoneNumber: "+9999999999",
          username: "newusername",
          password: "SecurePass1",
        })
      ).rejects.toThrow(InvalidInviteError);
    });
  });

  describe("username validation", () => {
    it("should throw error when username already taken", async () => {
      mockInviteRepository.acceptInviteTransaction = mock(async () => {
        throw new Error("User already exists");
      });

      await expect(
        acceptInviteUseCase.execute({
          token: "valid-token",
          email: "newuser@example.com",
          username: "existingusername",
          password: "SecurePass1",
        })
      ).rejects.toThrow("User already exists");
    });
  });

  describe("repository failures", () => {
    it("should propagate error when transaction fails", async () => {
      mockInviteRepository.acceptInviteTransaction = mock(async () => {
        throw new Error("Database error");
      });

      await expect(
        acceptInviteUseCase.execute({
          token: "valid-token",
          email: "newuser@example.com",
          username: "newusername",
          password: "SecurePass1",
        })
      ).rejects.toThrow("Database error");
    });

    it("should propagate error when user creation fails in transaction", async () => {
      mockInviteRepository.acceptInviteTransaction = mock(async () => {
        throw new Error("Create user failed");
      });

      await expect(
        acceptInviteUseCase.execute({
          token: "valid-token",
          email: "newuser@example.com",
          username: "newusername",
          password: "SecurePass1",
        })
      ).rejects.toThrow("Create user failed");
    });
  });
});
