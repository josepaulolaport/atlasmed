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

describe("Refresh Session Race Condition Integration Tests", () => {
  let sessionRepository: PrismaSessionRepository;
  let userRepository: PrismaUserRepository;
  let sessionCache: SessionCacheService;
  let refreshSessionUseCase: RefreshSessionUseCase;
  let loginUseCase: LoginUseCase;
  let testUser: any;

  beforeAll(async () => {
    sessionRepository = new PrismaSessionRepository();
    userRepository = new PrismaUserRepository();
    sessionCache = new SessionCacheService();

    refreshSessionUseCase = new RefreshSessionUseCase({
      sessionRepository,
      sessionCache,
    });

    loginUseCase = new LoginUseCase({
      userRepository,
      sessionRepository,
      sessionCache,
      redis,
    });

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
    // Clean sessions and cache before each test
    await prisma.session.deleteMany({ where: { userId: testUser.id } });
    await redis.flushdb(); // Clear Redis cache
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.session.deleteMany({ where: { userId: testUser.id } });
  });

  afterAll(async () => {
    // Clean up test user
    await prisma.session.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("should handle concurrent refresh attempts atomically", async () => {
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
  });

  test("should ensure old session is revoked after successful refresh", async () => {
    const loginResult = await loginUseCase.execute({
      identifier: testUser.email,
      password: "Password123!",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    const oldSessionId = loginResult.user.sessions?.[0]?.id;
    const refreshToken = loginResult.refreshToken;

    await refreshSessionUseCase.execute({
      refreshToken,
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    if (oldSessionId) {
      const oldSession = await sessionRepository.findById(oldSessionId);
      expect(oldSession?.revokedAt).not.toBeNull();
    }
  });

  test("should prevent using refresh token after successful refresh", async () => {
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

    await expect(
      refreshSessionUseCase.execute({
        refreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      })
    ).rejects.toThrow();
  });

  test("should not leave user locked out on refresh failure", async () => {
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
