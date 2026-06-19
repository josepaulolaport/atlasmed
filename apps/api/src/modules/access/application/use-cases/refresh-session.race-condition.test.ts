import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { hash } from "argon2";
import { prisma } from "../../../../infrastructure/database/prisma.client";
import { RefreshSessionUseCase } from "./refresh-session.use-case";
import { LoginUseCase } from "./login.use-case";
import { PrismaSessionRepository } from "../../infrastructure/repositories/prisma/prisma-session.repository";
import { PrismaUserRepository } from "../../infrastructure/repositories/prisma/prisma-user.repository";
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
  let sessionRepository: PrismaSessionRepository;
  let userRepository: PrismaUserRepository;
  let sessionCache: SessionCacheService;
  let refreshSessionUseCase: RefreshSessionUseCase;
  let loginUseCase: LoginUseCase;
  let testUser: any;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    sessionRepository = new PrismaSessionRepository();
    userRepository = new PrismaUserRepository();
    sessionCache = new SessionCacheService();

    const { accessUseCases } = await import("../../composition");

    refreshSessionUseCase = accessUseCases.refreshSession();
    loginUseCase = accessUseCases.login();

    // Create a dedicated test user for this test suite
    const userRole = await prisma.role.findUnique({
      where: { name: "USER" },
    });

    if (!userRole) {
      throw new Error("USER role not found in database");
    }

    const uniqueId = getUniqueTestId();
    const passwordHash = await hash("Password123!");

    testUser = await prisma.user.create({
      data: {
        email: `refresh_race_${uniqueId}@example.com`,
        username: `refresh_race_${uniqueId}`,
        passwordHash,
        firstName: "Refresh",
        lastName: "Test",
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      },
      include: { role: true },
    });
  });

  beforeEach(async () => {
    if (!dbReady || !testUser) return;
    await prisma.session.deleteMany({ where: { userId: testUser.id } });
    await redis.flushdb();
  });

  afterEach(async () => {
    if (!dbReady || !testUser) return;
    await prisma.session.deleteMany({ where: { userId: testUser.id } });
  });

  afterAll(async () => {
    if (!dbReady) {
      await prisma.$disconnect().catch(() => {});
      return;
    }

    await prisma.session.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    await prisma.$disconnect();
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

    const activeSessions = await prisma.session.findMany({
      where: { userId: testUser.id, revokedAt: null },
    });
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

    const activeSessions = await prisma.session.findMany({
      where: { userId: testUser.id, revokedAt: null },
    });

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

    const activeSession = await prisma.session.findFirst({
      where: { userId: testUser.id, revokedAt: null },
    });

    expect(activeSession).toBeDefined();

    await redis.flushdb();

    await prisma.session.update({
      where: { id: activeSession!.id },
      data: { updatedAt: new Date(Date.now() - 11_000) },
    });

    await expect(
      refreshSessionUseCase.execute({
        refreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      })
    ).rejects.toThrow(RefreshTokenReuseDetectedError);

    const sessions = await prisma.session.findMany({
      where: { userId: testUser.id },
    });

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        userId: testUser.id,
        eventType: "SUSPICIOUS_ACTIVITY",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditLog).toBeDefined();
    expect((auditLog?.details as { reason?: string } | null)?.reason).toBe(
      "refresh_token_reuse"
    );
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
