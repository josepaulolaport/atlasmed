import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { hash } from "argon2";
import { eq, and, isNull } from "drizzle-orm";
import { roles, users, sessions } from "@atlasmed/database";
import { db } from "../../../../infrastructure/database/db";
import { RefreshSessionUseCase } from "./refresh-session.use-case";
import { LoginUseCase } from "./login.use-case";
import { DrizzleSessionRepository } from "../../infrastructure/repositories/drizzle/drizzle-session.repository";
import { DrizzleUserRepository } from "../../infrastructure/repositories/drizzle/drizzle-user.repository";
import { SessionCacheService } from "../../infrastructure/cache/session-cache.service";
import { redis } from "../../../../infrastructure/cache/redis.client";
import { getUniqueTestId } from "../../../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../../../test-utils/integration-database";
import { RefreshTokenReuseDetectedError, TokenInvalidError } from "../../../../shared/errors";

/**
 * RACE CONDITION TESTS WITH PESSIMISTIC LOCKING
 * 
 * These tests verify that concurrent session refresh attempts are handled atomically
 * using pessimistic locking (SELECT FOR UPDATE).
 * 
 * With pessimistic locking:
 * - The first refresh attempt locks the session row
 * - Concurrent attempts wait for the lock to be released
 * - Only one refresh succeeds, others fail with "Session has been revoked"
 */
describe("Refresh Session Race Condition Integration Tests", () => {
  let dbReady = false;
  let sessionRepository: DrizzleSessionRepository;
  let userRepository: DrizzleUserRepository;
  let sessionCache: SessionCacheService;
  let refreshSessionUseCase: RefreshSessionUseCase;
  let loginUseCase: LoginUseCase;
  let testUser: any;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    sessionRepository = new DrizzleSessionRepository();
    userRepository = new DrizzleUserRepository();
    sessionCache = new SessionCacheService();

    const { accessUseCases } = await import("../../composition");

    refreshSessionUseCase = accessUseCases.refreshSession();
    loginUseCase = accessUseCases.login();

    const userRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "USER"))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!userRole) {
      throw new Error("USER role not found in database");
    }

    const uniqueId = getUniqueTestId();
    const passwordHash = await hash("Password123!");

    testUser = await db
      .insert(users)
      .values({
        email: `refresh_race_${uniqueId}@example.com`,
        username: `refresh_race_${uniqueId}`,
        passwordHash,
        firstName: "Refresh",
        lastName: "Test",
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      })
      .returning()
      .then((r) => r[0]!);
  });

  beforeEach(async () => {
    if (!dbReady || !testUser) return;
    await db.delete(sessions).where(eq(sessions.userId, testUser.id));
    await redis.flushdb();
  });

  afterEach(async () => {
    if (!dbReady || !testUser) return;
    await db.delete(sessions).where(eq(sessions.userId, testUser.id));
  });

  afterAll(async () => {
    if (!dbReady) return;

    await db.delete(sessions).where(eq(sessions.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id)).catch(() => {});
  });

  test("should handle concurrent refresh attempts atomically", async () => {
    if (!dbReady) return;

    const loginResult = await loginUseCase.execute({
      identifier: testUser.email,
      password: "Password123!",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    const refreshToken = loginResult.refreshToken;

    const results = await Promise.allSettled([
      refreshSessionUseCase.execute({
        refreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      }),
      refreshSessionUseCase.execute({
        refreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      }),
      refreshSessionUseCase.execute({
        refreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      }),
    ]);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(2);

    const successResult = results.find((r) => r.status === "fulfilled") as any;
    expect(successResult.value.accessToken).toBeDefined();
    expect(successResult.value.refreshToken).toBeDefined();
    expect(successResult.value.refreshToken).not.toBe(refreshToken);

    const failedResults = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    for (const failure of failedResults) {
      expect(failure.reason).toBeInstanceOf(TokenInvalidError);
    }

    const activeSessions = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, testUser.id), isNull(sessions.revokedAt)));
    expect(activeSessions.length).toBe(1);
  });

  test("should preserve session identity after successful refresh", async () => {
    if (!dbReady) return;

    const loginResult = await loginUseCase.execute({
      identifier: testUser.email,
      password: "Password123!",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    const oldSessions = await sessionRepository.findByUserId(testUser.id);
    const oldSessionId = oldSessions[0]?.id;
    const refreshToken = loginResult.refreshToken;

    await refreshSessionUseCase.execute({
      refreshToken,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    if (oldSessionId) {
      const session = await sessionRepository.findById(oldSessionId);
      expect(session?.revokedAt).toBeNull();
      expect(session?.id).toBe(oldSessionId);
    }
  });

  test("should reject old refresh token within grace window without revoking sessions", async () => {
    if (!dbReady) return;

    const loginResult = await loginUseCase.execute({
      identifier: testUser.email,
      password: "Password123!",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    const refreshToken = loginResult.refreshToken;

    await refreshSessionUseCase.execute({
      refreshToken,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    await expect(
      refreshSessionUseCase.execute({
        refreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      })
    ).rejects.toThrow(TokenInvalidError);

    const activeSessions = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, testUser.id), isNull(sessions.revokedAt)));

    expect(activeSessions.length).toBe(1);
  });

  test("should detect refresh token reuse after grace window via DB fallback", async () => {
    if (!dbReady) return;

    const loginResult = await loginUseCase.execute({
      identifier: testUser.email,
      password: "Password123!",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    const refreshToken = loginResult.refreshToken;

    const firstRefresh = await refreshSessionUseCase.execute({
      refreshToken,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    expect(firstRefresh.accessToken).toBeDefined();

    const activeSession = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, testUser.id), isNull(sessions.revokedAt)))
      .limit(1)
      .then((r) => r[0] ?? null);

    expect(activeSession).toBeDefined();

    await redis.flushdb();

    await db
      .update(sessions)
      .set({ updatedAt: new Date(Date.now() - 11_000) })
      .where(eq(sessions.id, activeSession!.id));

    await expect(
      refreshSessionUseCase.execute({
        refreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      })
    ).rejects.toThrow(RefreshTokenReuseDetectedError);

    const allSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, testUser.id));

    expect(allSessions.length).toBeGreaterThan(0);
    expect(allSessions.every((session) => session.revokedAt !== null)).toBe(true);
  });

  test("should not leave user locked out on refresh failure", async () => {
    if (!dbReady) return;

    const loginResult = await loginUseCase.execute({
      identifier: testUser.email,
      password: "Password123!",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    const refreshToken = loginResult.refreshToken;

    await refreshSessionUseCase.execute({
      refreshToken,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    const canLogin = await loginUseCase.execute({
      identifier: testUser.email,
      password: "Password123!",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    expect(canLogin.accessToken).toBeDefined();
  });
});
