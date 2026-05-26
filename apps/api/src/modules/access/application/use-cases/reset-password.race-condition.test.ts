import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { hash } from "argon2";
import { prisma } from "../../../../infrastructure/database/prisma.client";
import { ResetPasswordUseCase } from "./reset-password.use-case";
import { PrismaUserRepository } from "../../infrastructure/repositories/prisma/prisma-user.repository";
import { PrismaPasswordResetRepository } from "../../infrastructure/repositories/prisma/prisma-password-reset.repository";
import { createMockAuthCache, createMockSessionCache } from "../../test-helpers/fixtures";
import { getUniqueTestId } from "../../../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../../../test-utils/integration-database";
import { generateRandomToken } from "../../../../shared/utils/generate-random-token";
import { hashToken } from "../../../../shared/utils/hash-token";
import { ResetTokenUsedError } from "../../../../shared/errors";

/**
 * RACE CONDITION TESTS WITH PESSIMISTIC LOCKING
 *
 * Verifies concurrent password reset confirmations with the same token:
 * - First attempt locks the password_resets row (SELECT FOR UPDATE)
 * - Concurrent attempts wait, then fail once usedAt is set
 * - Exactly one reset succeeds
 */
describe("Reset Password Race Condition Integration Tests", () => {
  let dbReady = false;
  let userRepository: PrismaUserRepository;
  let passwordResetRepository: PrismaPasswordResetRepository;
  let resetPasswordUseCase: ResetPasswordUseCase;
  let testUser: any;
  let resetToken: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    userRepository = new PrismaUserRepository();
    passwordResetRepository = new PrismaPasswordResetRepository({ prisma });

    resetPasswordUseCase = new ResetPasswordUseCase({
      userRepository,
      passwordResetRepository,
      authCache: createMockAuthCache(),
      sessionCache: createMockSessionCache(),
    });

    const userRole = await prisma.role.findUnique({
      where: { name: "USER" },
    });

    if (!userRole) {
      throw new Error("USER role not found in database");
    }

    const uniqueId = getUniqueTestId();
    const passwordHash = await hash("OriginalPass1!");

    testUser = await prisma.user.create({
      data: {
        email: `reset_race_${uniqueId}@example.com`,
        username: `reset_race_${uniqueId}`,
        passwordHash,
        firstName: "Reset",
        lastName: "Race",
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      },
      include: { role: true },
    });
  });

  beforeEach(async () => {
    if (!dbReady || !testUser) return;

    await prisma.passwordReset.deleteMany({ where: { userId: testUser.id } });
    await prisma.session.deleteMany({ where: { userId: testUser.id } });

    resetToken = generateRandomToken();
    await prisma.passwordReset.create({
      data: {
        userId: testUser.id,
        tokenHash: hashToken(resetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    if (!dbReady) {
      await prisma.$disconnect().catch(() => {});
      return;
    }

    await prisma.passwordReset.deleteMany({ where: { userId: testUser.id } });
    await prisma.session.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  test("concurrent confirms with same token — exactly one succeeds", async () => {
    if (!dbReady) return;

    const newPassword = "ConcurrentPass1!";

    const results = await Promise.allSettled([
      resetPasswordUseCase.execute({ token: resetToken, newPassword }),
      resetPasswordUseCase.execute({ token: resetToken, newPassword: "ConcurrentPass2!" }),
    ]);

    const successes = results.filter((result) => result.status === "fulfilled");
    const failures = results.filter((result) => result.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failedResult = failures[0] as PromiseRejectedResult;
    expect(failedResult.reason).toBeInstanceOf(ResetTokenUsedError);

    const resetRecord = await prisma.passwordReset.findFirst({
      where: { userId: testUser.id, tokenHash: hashToken(resetToken) },
    });
    expect(resetRecord?.usedAt).toBeInstanceOf(Date);
  });
});
