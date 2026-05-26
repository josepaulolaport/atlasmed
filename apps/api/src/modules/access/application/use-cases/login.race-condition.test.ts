import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { hash } from "argon2";
import { prisma } from "../../../../infrastructure/database/prisma.client";
import type { LoginUseCase } from "./login.use-case";
import { accessUseCases } from "../../composition";
import { redis } from "../../../../infrastructure/cache/redis.client";
import { getUniqueTestId } from "../../../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../../../test-utils/integration-database";
import { sessionsMatchSameDevice } from "../../../../shared/utils/device-fingerprint";

/**
 * RACE CONDITION TESTS WITH PESSIMISTIC LOCKING
 *
 * These tests verify that concurrent login attempts from the same device
 * are handled atomically using pessimistic locking (SELECT FOR UPDATE).
 *
 * With pessimistic locking:
 * - Each login transaction locks all active session rows for the user
 * - Concurrent logins wait for the lock to be released
 * - Same-device sessions are revoked and replaced within the transaction
 * - Only one active same-device session remains after concurrent logins
 */
describe("Login Session Race Condition Integration Tests", () => {
  let dbReady = false;
  let loginUseCase: LoginUseCase;
  let testUser: any;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    loginUseCase = accessUseCases.login();

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
        email: `login_race_${uniqueId}@example.com`,
        username: `login_race_${uniqueId}`,
        passwordHash,
        firstName: "Login",
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

  test("should leave exactly one active same-device session after concurrent logins", async () => {
    if (!dbReady) return;

    const userAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) login-race-test";

    const results = await Promise.allSettled([
      loginUseCase.execute({
        identifier: testUser.email,
        password: "Password123!",
        ipAddress: "127.0.0.1",
        userAgent,
      }),
      loginUseCase.execute({
        identifier: testUser.email,
        password: "Password123!",
        ipAddress: "127.0.0.1",
        userAgent,
      }),
      loginUseCase.execute({
        identifier: testUser.email,
        password: "Password123!",
        ipAddress: "127.0.0.1",
        userAgent,
      }),
    ]);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    expect(successCount).toBe(3);

    const activeSessions = await prisma.session.findMany({
      where: {
        userId: testUser.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    const deviceReference = activeSessions[0] ?? {
      id: "reference",
      deviceFingerprint: null,
      userAgent,
      deviceType: "DESKTOP",
    };

    const activeSameDeviceSessions = activeSessions.filter((session) =>
      sessionsMatchSameDevice(deviceReference, session)
    );

    expect(activeSameDeviceSessions.length).toBe(1);
    expect(activeSessions.length).toBe(1);
  });
});
