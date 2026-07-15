import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { hash } from "argon2";
import { eq, and } from "drizzle-orm";
import { roles, users, sessions, passwordResets } from "@atlasmed/database";
import { db } from "../../../../infrastructure/database/db";
import { ResetPasswordUseCase } from "./reset-password.use-case";
import { DrizzleUserRepository } from "../../infrastructure/repositories/drizzle/drizzle-user.repository";
import { DrizzlePasswordResetRepository } from "../../infrastructure/repositories/drizzle/drizzle-password-reset.repository";
import { createMockAuditLogService } from "../../test-helpers/audit-mocks";
import { createMockMetricsService } from "../../test-helpers/metrics-mocks";
import { PasswordService } from "../services/password.service";
import { NotificationService } from "../services/notification.service";
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
  let userRepository: DrizzleUserRepository;
  let passwordResetRepository: DrizzlePasswordResetRepository;
  let resetPasswordUseCase: ResetPasswordUseCase;
  let testUser: any;
  let resetToken: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    userRepository = new DrizzleUserRepository();
    passwordResetRepository = new DrizzlePasswordResetRepository();

    resetPasswordUseCase = new ResetPasswordUseCase({
      userRepository,
      passwordResetRepository,
      authCache: createMockAuthCache(),
      sessionCache: createMockSessionCache(),
      passwordService: new PasswordService(),
      notificationService: new NotificationService(),
      auditLog: createMockAuditLogService(),
      metrics: createMockMetricsService(),
    });

    const userRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "REP"))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!userRole) {
      throw new Error("REP role not found in database");
    }

    const uniqueId = getUniqueTestId();
    const passwordHash = await hash("OriginalPass1!");

    testUser = await db
      .insert(users)
      .values({
        email: `reset_race_${uniqueId}@example.com`,
        username: `reset_race_${uniqueId}`,
        passwordHash,
        firstName: "Reset",
        lastName: "Race",
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      })
      .returning()
      .then((r) => r[0]!);
  });

  beforeEach(async () => {
    if (!dbReady || !testUser) return;

    await db.delete(passwordResets).where(eq(passwordResets.userId, testUser.id));
    await db.delete(sessions).where(eq(sessions.userId, testUser.id));

    resetToken = generateRandomToken();
    await db.insert(passwordResets).values({
      userId: testUser.id,
      tokenHash: hashToken(resetToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    await db.delete(passwordResets).where(eq(passwordResets.userId, testUser.id));
    await db.delete(sessions).where(eq(sessions.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id));
  });

  test("concurrent confirms with same token — exactly one succeeds", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

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

    const resetRecord = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.userId, testUser.id),
          eq(passwordResets.tokenHash, hashToken(resetToken)),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null);
    expect(resetRecord?.usedAt).toBeInstanceOf(Date);
  });
});
