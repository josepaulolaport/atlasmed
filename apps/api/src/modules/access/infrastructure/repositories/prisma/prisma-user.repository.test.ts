import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { hash } from "argon2";
import { prisma } from "../../../../../infrastructure/database/prisma.client";
import { PrismaUserRepository } from "./prisma-user.repository";
import { createTestUserParams } from "../../../../../test-utils/user-test-helpers";
import { cleanTestData, getUniqueTestId } from "../../../../../test-utils/database-helpers";
import { hashToken } from "../../../../../shared/utils/hash-token";
import {
  PasswordReuseError,
  ResetTokenExpiredError,
  ResetTokenInvalidError,
  ResetTokenUsedError,
} from "../../../../../shared/errors";
import { PASSWORD_HISTORY_LIMIT } from "../../../application/constants/password.constants";

describe("PrismaUserRepository (Integration)", () => {
  let userRepository: PrismaUserRepository;
  let testRoleId: string;

  beforeAll(async () => {
    // Use existing seeded role instead of creating a new one
    const testRole = await prisma.role.findUnique({
      where: { name: "USER" },
    });
    
    if (!testRole) {
      throw new Error("USER role not found in seeded database");
    }
    
    testRoleId = testRole.id;
  });

  afterAll(async () => {
    // Clean up test data but don't delete the seeded role
    await prisma.user.deleteMany({
      where: {
        email: { contains: "test" },
      },
    });
  });

  beforeEach(async () => {
    await cleanTestData(prisma);
    userRepository = new PrismaUserRepository();
  });

  describe("create", () => {
    it("should create user with email", async () => {
      const params = createTestUserParams(testRoleId);

      const user = await userRepository.create(params);

      expect(user).toBeDefined();
      expect(user.email).toBe(params.email);
      expect(user.username).toBe(params.username);
    });

    it("should create user with phone number", async () => {
      const params = createTestUserParams(testRoleId, {
        phoneNumber: "+1234567890",
      });

      const user = await userRepository.create(params);

      expect(user.phoneNumber).toBe("+1234567890");
    });

    it("should create user with firstName and lastName", async () => {
      const params = createTestUserParams(testRoleId, {
        firstName: "John",
        lastName: "Doe",
      });

      const user = await userRepository.create(params);

      expect(user.firstName).toBe("John");
      expect(user.lastName).toBe("Doe");
    });

    it("should include role in created user", async () => {
      const params = createTestUserParams(testRoleId);

      const user = await userRepository.create(params);

      expect(user.role).toBeDefined();
      expect(user.role.id).toBe(testRoleId);
    });

    it("should set default status to PENDING", async () => {
      const params = createTestUserParams(testRoleId);

      const user = await userRepository.create(params);

      expect(user.status).toBe("PENDING");
    });

    it("should allow custom status", async () => {
      const params = createTestUserParams(testRoleId, {
        status: "ACTIVE",
      });

      const user = await userRepository.create(params);

      expect(user.status).toBe("ACTIVE");
    });
  });

  describe("findByIdentifier", () => {
    beforeEach(async () => {
      await userRepository.create({
        email: "user@example.com",
        username: createTestUserParams(testRoleId).username,
        phoneNumber: "+1234567890",
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });
    });

    it("should find user by email", async () => {
      const user = await userRepository.findByIdentifier({
        identifier: "user@example.com",
      });

      expect(user).not.toBeNull();
      expect(user?.email).toBe("user@example.com");
    });

    it("should find user by username", async () => {
      // First create a user to find
      const params = createTestUserParams(testRoleId);
      await userRepository.create(params);

      const user = await userRepository.findByIdentifier({
        identifier: params.username,
      });

      expect(user).not.toBeNull();
      expect(user?.username).toBe(params.username);
    });

    it("should find user by phone number", async () => {
      const user = await userRepository.findByIdentifier({
        identifier: "+1234567890",
      });

      expect(user).not.toBeNull();
      expect(user?.phoneNumber).toBe("+1234567890");
    });

    it("should return null when user not found", async () => {
      const user = await userRepository.findByIdentifier({
        identifier: "nonexistent@example.com",
      });

      expect(user).toBeNull();
    });

    it("should include role when user found", async () => {
      const user = await userRepository.findByIdentifier({
        identifier: "user@example.com",
      });

      expect(user?.role).toBeDefined();
      expect(user?.role.id).toBe(testRoleId);
    });
  });

  describe("findById", () => {
    it("should find user by ID", async () => {
      const created = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });

      const user = await userRepository.findById(created.id);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(created.id);
    });

    it("should include role when user found", async () => {
      const created = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });

      const user = await userRepository.findById(created.id);

      expect(user?.role).toBeDefined();
      expect(user?.role.id).toBe(testRoleId);
    });

    it("should return null when user not found", async () => {
      const user = await userRepository.findById("non-existent-id");

      expect(user).toBeNull();
    });
  });

  describe("findUserAuthStatus", () => {
    it("should return auth status fields only", async () => {
      const created = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      const status = await userRepository.findUserAuthStatus(created.id);

      expect(status).toEqual({
        status: "ACTIVE",
        tokenVersion: created.tokenVersion,
        roleId: testRoleId,
        roleName: "USER",
      });
    });

    it("should return null when user not found", async () => {
      const status = await userRepository.findUserAuthStatus("non-existent-id");

      expect(status).toBeNull();
    });
  });

  describe("updateLastLogin", () => {
    it("should update last login timestamp", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });

      const before = user.lastLoginAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await userRepository.updateLastLogin(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.lastLoginAt).not.toEqual(before);
      expect(updated?.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe("deactivate", () => {
    it("should set user status to INACTIVE", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      await userRepository.deactivate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.status).toBe("INACTIVE");
    });

    it("should set deactivatedAt timestamp", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      await userRepository.deactivate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.deactivatedAt).toBeInstanceOf(Date);
    });

    it("should increment tokenVersion by 1", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      const beforeVersion = user.tokenVersion;

      await userRepository.deactivate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.tokenVersion).toBe(beforeVersion + 1);
    });
  });

  describe("activate", () => {
    it("should set user status to ACTIVE", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "INACTIVE",
      });

      await userRepository.activate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.status).toBe("ACTIVE");
    });

    it("should clear deactivatedAt timestamp", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "INACTIVE",
      });

      await userRepository.deactivate(user.id);
      await userRepository.activate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.deactivatedAt).toBeNull();
    });

    it("should not increment tokenVersion", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      await userRepository.deactivate(user.id);

      const afterDeactivate = await userRepository.findById(user.id);
      const versionAfterDeactivate = afterDeactivate!.tokenVersion;

      await userRepository.activate(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.tokenVersion).toBe(versionAfterDeactivate);
    });
  });

  describe("suspend", () => {
    it("should set user status to SUSPENDED", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      await userRepository.suspend(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.status).toBe("SUSPENDED");
    });

    it("should increment tokenVersion by 1", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      const beforeVersion = user.tokenVersion;

      await userRepository.suspend(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.tokenVersion).toBe(beforeVersion + 1);
    });
  });

  describe("unsuspend", () => {
    it("should set user status to ACTIVE", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "SUSPENDED",
      });

      await userRepository.unsuspend(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.status).toBe("ACTIVE");
    });

    it("should not increment tokenVersion", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      await userRepository.suspend(user.id);

      const afterSuspend = await userRepository.findById(user.id);
      const versionAfterSuspend = afterSuspend!.tokenVersion;

      await userRepository.unsuspend(user.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.tokenVersion).toBe(versionAfterSuspend);
    });
  });

  describe("incrementTokenVersion", () => {
    it("should increment tokenVersion and return the new value", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      const beforeVersion = user.tokenVersion;

      const newVersion = await userRepository.incrementTokenVersion(user.id);

      expect(newVersion).toBe(beforeVersion + 1);

      const updated = await userRepository.findById(user.id);

      expect(updated?.tokenVersion).toBe(newVersion);
    });
  });

  describe("updateRole", () => {
    it("should update user roleId without changing tokenVersion", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
        status: "ACTIVE",
      });

      const managerRole = await prisma.role.findUnique({
        where: { name: "MANAGER" },
      });

      if (!managerRole) {
        throw new Error("MANAGER role not found in seeded database");
      }

      await userRepository.updateRole(user.id, managerRole.id);

      const updated = await userRepository.findById(user.id);

      expect(updated?.roleId).toBe(managerRole.id);
      expect(updated?.tokenVersion).toBe(user.tokenVersion);
    });
  });

  describe("delete", () => {
    it("should delete user", async () => {
      const user = await userRepository.create({
        email: createTestUserParams(testRoleId).email,
        username: createTestUserParams(testRoleId).username,
        passwordHash: "$argon2id$test",
        roleId: testRoleId,
      });

      await userRepository.delete(user.id);

      const deleted = await userRepository.findById(user.id);

      expect(deleted).toBeNull();
    });
  });

  describe("resetPasswordTransaction", () => {
    const originalPassword = "OriginalPass1!";
    let user: Awaited<ReturnType<typeof userRepository.create>>;
    let tokenHash: string;

    beforeEach(async () => {
      const passwordHash = await hash(originalPassword);
      user = await userRepository.create({
        ...createTestUserParams(testRoleId, { status: "ACTIVE" }),
        passwordHash,
      });

      tokenHash = hashToken(`reset_${getUniqueTestId()}`);
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: hashToken(`session_${getUniqueTestId()}`),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    });

    it("should reset password with valid token", async () => {
      const newPassword = "NewSecurePass1!";
      const newPasswordHash = await hash(newPassword);
      const beforeVersion = user.tokenVersion;

      const result = await userRepository.resetPasswordTransaction({
        tokenHash,
        newPassword,
        newPasswordHash,
      });

      expect(result.user.passwordHash).toBe(newPasswordHash);
      expect(result.user.tokenVersion).toBe(beforeVersion + 1);
      expect(result.passwordReset.usedAt).toBeInstanceOf(Date);
    });

    it("should reject second use of the same token", async () => {
      const newPassword = "NewSecurePass1!";
      const newPasswordHash = await hash(newPassword);

      await userRepository.resetPasswordTransaction({
        tokenHash,
        newPassword,
        newPasswordHash,
      });

      await expect(
        userRepository.resetPasswordTransaction({
          tokenHash,
          newPassword: "AnotherPass1!",
          newPasswordHash: await hash("AnotherPass1!"),
        })
      ).rejects.toThrow(ResetTokenUsedError);
    });

    it("should revoke all active sessions", async () => {
      const newPassword = "NewSecurePass1!";
      const newPasswordHash = await hash(newPassword);

      await userRepository.resetPasswordTransaction({
        tokenHash,
        newPassword,
        newPasswordHash,
      });

      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
      expect(sessions.every((session) => session.revokedReason === "Password reset")).toBe(true);
    });

    it("should update password history and reject reused password", async () => {
      const firstNewPassword = "FirstNewPass1!";
      const firstNewPasswordHash = await hash(firstNewPassword);
      const originalHash = user.passwordHash;

      await userRepository.resetPasswordTransaction({
        tokenHash,
        newPassword: firstNewPassword,
        newPasswordHash: firstNewPasswordHash,
      });

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.passwordHistory).toHaveLength(1);
      expect(updatedUser?.passwordHistory[0]).toBe(originalHash);

      const secondTokenHash = hashToken(`reset2_${getUniqueTestId()}`);
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: secondTokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await expect(
        userRepository.resetPasswordTransaction({
          tokenHash: secondTokenHash,
          newPassword: originalPassword,
          newPasswordHash: await hash(originalPassword),
        })
      ).rejects.toThrow(PasswordReuseError);
    });

    it("should throw ResetTokenInvalidError for unknown token", async () => {
      await expect(
        userRepository.resetPasswordTransaction({
          tokenHash: hashToken("unknown-token"),
          newPassword: "NewSecurePass1!",
          newPasswordHash: await hash("NewSecurePass1!"),
        })
      ).rejects.toThrow(ResetTokenInvalidError);
    });

    it("should throw ResetTokenExpiredError for expired token", async () => {
      const expiredTokenHash = hashToken(`expired_${getUniqueTestId()}`);
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: expiredTokenHash,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await expect(
        userRepository.resetPasswordTransaction({
          tokenHash: expiredTokenHash,
          newPassword: "NewSecurePass1!",
          newPasswordHash: await hash("NewSecurePass1!"),
        })
      ).rejects.toThrow(ResetTokenExpiredError);
    });

    it("should keep only the last N password hashes in history", async () => {
      const passwords = Array.from({ length: PASSWORD_HISTORY_LIMIT + 1 }, (_, index) =>
        `HistoryPass${index + 1}!`
      );

      let currentTokenHash = tokenHash;

      for (const nextPassword of passwords) {
        const nextPasswordHash = await hash(nextPassword);
        await userRepository.resetPasswordTransaction({
          tokenHash: currentTokenHash,
          newPassword: nextPassword,
          newPasswordHash: nextPasswordHash,
        });

        currentTokenHash = hashToken(`history_${getUniqueTestId()}_${nextPassword}`);
        await prisma.passwordReset.create({
          data: {
            userId: user.id,
            tokenHash: currentTokenHash,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
      }

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.passwordHistory).toHaveLength(PASSWORD_HISTORY_LIMIT);
    });
  });
});
