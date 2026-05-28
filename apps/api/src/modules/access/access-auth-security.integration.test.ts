import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { hash } from "argon2";
import { REFRESH_TOKEN_COOKIE_NAME } from "@atlasmed/access";
import { access } from "./index";
import { AppError } from "../../shared/errors";
import { prisma } from "../../infrastructure/database/prisma.client";
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
    if (!dbReady) return;

    app = createAuthIntegrationApp();
    await redis.flushdb();

    const uniqueId = getUniqueTestId();
    userEmail = `auth.security.${uniqueId}@test.example.com`;

    const userRole = await prisma.role.findUnique({ where: { name: "USER" } });
    const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
    if (!userRole || !adminRole) {
      throw new Error("USER or ADMIN role not found in seeded database");
    }

    userRoleId = userRole.id;

    const user = await prisma.user.create({
      data: {
        email: userEmail,
        username: `auth_sec_${uniqueId}`,
        passwordHash: await hash(TEST_PASSWORD),
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    userId = user.id;

    const admin = await prisma.user.create({
      data: {
        email: `auth.security.admin.${uniqueId}@test.example.com`,
        username: `auth_sec_admin_${uniqueId}`,
        passwordHash: await hash(TEST_PASSWORD),
        roleId: adminRole.id,
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    adminId = admin.id;
  });

  afterAll(async () => {
    if (!dbReady) return;
    await prisma.invitation.deleteMany({
      where: { invitedByUserId: { in: [userId, adminId] } },
    });
    await prisma.passwordReset.deleteMany({
      where: { userId: { in: [userId, adminId] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [userId, adminId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userId, adminId] } },
    }).catch(() => {});
  });

  async function login(identifier: string, password = TEST_PASSWORD) {
    const response = await app.handle(
      new Request("http://localhost/access/login", {
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
    if (!dbReady) return;

    const { refreshToken } = await login(userEmail, TEST_PASSWORD);
    expect(refreshToken).toBeTruthy();

    const resetToken = generateRandomToken();
    await prisma.passwordReset.create({
      data: {
        userId,
        tokenHash: hashToken(resetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
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
      new Request("http://localhost/access/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
    );

    expect(oldRefreshResponse.status).toBe(401);

    const loginResponse = await app.handle(
      new Request("http://localhost/access/login", {
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
    if (!dbReady) return;

    const { accessToken, refreshToken: initialRefreshToken } = await login(
      userEmail,
      "ResetPassword789!"
    );
    expect(initialRefreshToken).toBeTruthy();

    const refreshResponse = await app.handle(
      new Request("http://localhost/access/refresh", {
        method: "POST",
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
      new Request("http://localhost/access/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: initialRefreshToken }),
      })
    );

    expect(oldRefreshResponse.status).toBe(401);
  });

  it("returns REFRESH_TOKEN_REUSE_DETECTED without leaking internal ids", async () => {
    if (!dbReady) return;

    const { refreshToken } = await login(userEmail, NEW_PASSWORD);
    expect(refreshToken).toBeTruthy();

    const firstRefresh = await app.handle(
      new Request("http://localhost/access/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
    );

    expect(firstRefresh.status).toBe(200);

    const activeSession = await prisma.session.findFirst({
      where: { userId, revokedAt: null },
    });

    expect(activeSession).toBeDefined();

    await redis.flushdb();
    await prisma.session.update({
      where: { id: activeSession!.id },
      data: { updatedAt: new Date(Date.now() - 11_000) },
    });

    const reuseResponse = await app.handle(
      new Request("http://localhost/access/refresh", {
        method: "POST",
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
    if (!dbReady) return;

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
          roleId: userRoleId,
        }),
      })
    );

    expect(response.status).toBe(403);
  });

  it("accepts invite via register and allows login", async () => {
    if (!dbReady) return;

    const uniqueId = getUniqueTestId();
    const inviteEmail = `invited.${uniqueId}@test.example.com`;
    const inviteToken = generateRandomToken();

    await prisma.invitation.create({
      data: {
        email: inviteEmail,
        tokenHash: hashToken(inviteToken),
        roleId: userRoleId,
        invitedByUserId: adminId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "PENDING",
      },
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
      new Request("http://localhost/access/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: inviteEmail,
          password: "InvitedUser123!",
        }),
      })
    );

    expect(loginResponse.status).toBe(200);

    const invitedUser = await prisma.user.findUnique({
      where: { email: inviteEmail },
    });

    if (invitedUser) {
      await prisma.session.deleteMany({ where: { userId: invitedUser.id } });
      await prisma.user.delete({ where: { id: invitedUser.id } }).catch(() => {});
    }
  });
});
