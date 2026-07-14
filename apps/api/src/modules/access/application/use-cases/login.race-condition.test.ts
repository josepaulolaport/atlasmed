import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { hash } from "argon2";
import { eq, and, isNull, gt } from "drizzle-orm";
import { roles, users, sessions } from "@atlasmed/database";
import { db } from "../../../../infrastructure/database/db";
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
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    loginUseCase = accessUseCases.login();

    const userRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "REP"))
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
        email: `login_race_${uniqueId}@example.com`,
        username: `login_race_${uniqueId}`,
        passwordHash,
        firstName: "Login",
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
    await db.delete(sessions).where(eq(sessions.userId, testUser.id));
    await redis.flushdb();
  });

  afterEach(async () => {
    if (!dbReady || !testUser) return;
    await db.delete(sessions).where(eq(sessions.userId, testUser.id));
  });

  afterAll(async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    await db.delete(sessions).where(eq(sessions.userId, testUser.id));
    await db.delete(users).where(eq(users.id, testUser.id)).catch(() => {});
  });

  test("should leave exactly one active same-device session after concurrent logins", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

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

    const activeSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, testUser.id),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      );

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
