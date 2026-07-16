import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { hash } from "argon2";
import { REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { access } from "./index";
import { sessions as sessionsModule } from "../sessions";
import { AppError } from "../../shared/errors";
import { eq, inArray, isNull, and } from "drizzle-orm";
import { roles, users, sessions, invitations, passwordResets } from "@atlasmed/database";
import { db } from "../../infrastructure/database/db";
import { redis } from "../../infrastructure/cache/redis.client";
import { getUniqueTestId } from "../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../test-utils/integration-database";
import { hashToken } from "../../shared/utils/hash-token";
import { generateRandomToken } from "../../shared/utils/generate-random-token";

const TEST_PASSWORD = "Password123!";
const NEW_PASSWORD = "NewPassword456!";

function createAuthIntegrationApp() {
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { error: error.toClientJSON() };
      }

      set.status = 500;
      return {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    })
    .use(sessionsModule)
    .use(access);
}

function extractRefreshToken(setCookieHeader: string | null): string | undefined {
  return setCookieHeader?.match(
    new RegExp(`${REFRESH_TOKEN_COOKIE_NAME}=([^;]+)`)
  )?.[1];
}

describe("Access Auth Security HTTP Integration Tests", () => {
  let dbReady = false;
  let app: ReturnType<typeof createAuthIntegrationApp>;
  let userId: string;
  let userEmail: string;
  let adminId: string;
  let userRoleId: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    app = createAuthIntegrationApp();
    await redis.flushdb();

    const uniqueId = getUniqueTestId();
    userEmail = `auth.security.${uniqueId}@test.example.com`;

    const userRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "REP"))
      .limit(1)
      .then((r) => r[0] ?? null);
    const adminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "ADMIN"))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!userRole || !adminRole) {
      throw new Error("USER or ADMIN role not found in seeded database");
    }

    userRoleId = userRole.id;

    const user = await db
      .insert(users)
      .values({
        email: userEmail,
        username: `auth_sec_${uniqueId}`,
        passwordHash: await hash(TEST_PASSWORD),
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      })
      .returning()
      .then((r) => r[0]!);

    userId = user.id;

    const admin = await db
      .insert(users)
      .values({
        email: `auth.security.admin.${uniqueId}@test.example.com`,
        username: `auth_sec_admin_${uniqueId}`,
        passwordHash: await hash(TEST_PASSWORD),
        roleId: adminRole.id,
        status: "ACTIVE",
        emailVerified: true,
      })
      .returning()
      .then((r) => r[0]!);

    adminId = admin.id;
  });

  afterAll(async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");
    await db
      .delete(invitations)
      .where(inArray(invitations.invitedByUserId, [userId, adminId]));
    await db
      .delete(passwordResets)
      .where(inArray(passwordResets.userId, [userId, adminId]));
    await db.delete(sessions).where(inArray(sessions.userId, [userId, adminId]));
    await db.delete(users).where(inArray(users.id, [userId, adminId])).catch(() => {});
  });

  async function login(identifier: string, password = TEST_PASSWORD) {
    const response = await app.handle(
      new Request("http://localhost/session/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { session: { token: string } };

    return {
      accessToken: body.session.token,
      refreshToken: extractRefreshToken(response.headers.get("set-cookie")),
    };
  }

  it("completes password reset and invalidates existing refresh sessions", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const { refreshToken } = await login(userEmail, TEST_PASSWORD);
    expect(refreshToken).toBeTruthy();

    const resetToken = generateRandomToken();
    await db.insert(passwordResets).values({
      userId,
      tokenHash: hashToken(resetToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const resetResponse = await app.handle(
      new Request("http://localhost/access/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          newPassword: "ResetPassword789!",
        }),
      })
    );

    expect(resetResponse.status).toBe(200);

    const oldRefreshResponse = await app.handle(
      new Request("http://localhost/session/", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
    );

    expect(oldRefreshResponse.status).toBe(401);

    const loginResponse = await app.handle(
      new Request("http://localhost/session/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: userEmail,
          password: "ResetPassword789!",
        }),
      })
    );

    expect(loginResponse.status).toBe(200);
  });

  it("invalidates superseded refresh token after change password", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const { accessToken, refreshToken: initialRefreshToken } = await login(
      userEmail,
      "ResetPassword789!"
    );
    expect(initialRefreshToken).toBeTruthy();

    const refreshResponse = await app.handle(
      new Request("http://localhost/session/", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: initialRefreshToken }),
      })
    );

    expect(refreshResponse.status).toBe(200);

    const changeResponse = await app.handle(
      new Request("http://localhost/access/password", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "ResetPassword789!",
          newPassword: NEW_PASSWORD,
        }),
      })
    );

    expect(changeResponse.status).toBe(200);

    const oldRefreshResponse = await app.handle(
      new Request("http://localhost/session/", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: initialRefreshToken }),
      })
    );

    expect(oldRefreshResponse.status).toBe(401);
  });

  it("returns REFRESH_TOKEN_REUSE_DETECTED without leaking internal ids", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const { refreshToken } = await login(userEmail, NEW_PASSWORD);
    expect(refreshToken).toBeTruthy();

    const firstRefresh = await app.handle(
      new Request("http://localhost/session/", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
    );

    expect(firstRefresh.status).toBe(200);

    const activeSession = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .limit(1)
      .then((r) => r[0] ?? null);

    expect(activeSession).toBeDefined();

    await redis.flushdb();
    await db
      .update(sessions)
      .set({ updatedAt: new Date(Date.now() - 11_000) })
      .where(eq(sessions.id, activeSession!.id));

    const reuseResponse = await app.handle(
      new Request("http://localhost/session/", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
    );

    expect(reuseResponse.status).toBe(401);
    const body = (await reuseResponse.json()) as {
      error: { code: string; userId?: string; sessionId?: string; context?: unknown };
    };

    expect(body.error.code).toBe("REFRESH_TOKEN_REUSE_DETECTED");
    expect(body.error.userId).toBeUndefined();
    expect(body.error.sessionId).toBeUndefined();
    expect(body.error.context).toBeUndefined();
  });

  it("returns 403 when USER attempts to create an invitation", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const { accessToken } = await login(userEmail, NEW_PASSWORD);

    const response = await app.handle(
      new Request("http://localhost/access/invite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "invited.user@example.com",
          firstName: "Invited",
          lastName: "User",
          roleId: userRoleId,
        }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("accepts invite via register and allows login", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const uniqueId = getUniqueTestId();
    const inviteEmail = `invited.${uniqueId}@test.example.com`;
    const inviteToken = generateRandomToken();

    await db.insert(invitations).values({
      email: inviteEmail,
      tokenHash: hashToken(inviteToken),
      roleId: userRoleId,
      invitedByUserId: adminId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "PENDING",
    });

    const registerResponse = await app.handle(
      new Request("http://localhost/access/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: inviteToken,
          email: inviteEmail,
          username: `invited_${uniqueId}`,
          password: "InvitedUser123!",
        }),
      })
    );

    expect(registerResponse.status).toBe(200);

    const loginResponse = await app.handle(
      new Request("http://localhost/session/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: inviteEmail,
          password: "InvitedUser123!",
        }),
      })
    );

    expect(loginResponse.status).toBe(200);

    const invitedUser = await db
      .select()
      .from(users)
      .where(eq(users.email, inviteEmail))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (invitedUser) {
      await db.delete(sessions).where(eq(sessions.userId, invitedUser.id));
      await db.delete(users).where(eq(users.id, invitedUser.id)).catch(() => {});
    }
  });
});
