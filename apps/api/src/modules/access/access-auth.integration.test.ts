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

const TEST_PASSWORD = "Password123!";

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

describe("Access Auth HTTP Integration Tests", () => {
  let dbReady = false;
  let app: ReturnType<typeof createAuthIntegrationApp>;
  let userId: string;
  let userEmail: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    app = createAuthIntegrationApp();
    await redis.flushdb();

    const uniqueId = getUniqueTestId();
    userEmail = `auth.http.${uniqueId}@test.example.com`;

    const userRole = await prisma.role.findUnique({ where: { name: "USER" } });
    if (!userRole) {
      throw new Error("USER role not found in seeded database");
    }

    const user = await prisma.user.create({
      data: {
        email: userEmail,
        username: `auth_http_${uniqueId}`,
        passwordHash: await hash(TEST_PASSWORD),
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    userId = user.id;
  });

  afterAll(async () => {
    if (!dbReady) return;
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  async function loginViaHttp() {
    const response = await app.handle(
      new Request("http://localhost/access/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: userEmail,
          password: TEST_PASSWORD,
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      session: { token: string };
      user: { email: string };
    };

    const refreshToken = response.headers
      .get("set-cookie")
      ?.match(new RegExp(`${REFRESH_TOKEN_COOKIE_NAME}=([^;]+)`))?.[1];

    return {
      accessToken: body.session.token,
      refreshToken,
      setCookieHeader: response.headers.get("set-cookie") ?? "",
    };
  }

  it("logs in and returns access token with refresh cookie", async () => {
    if (!dbReady) return;

    const { accessToken, refreshToken } = await loginViaHttp();
    expect(accessToken.split(".")).toHaveLength(3);
    expect(refreshToken).toBeTruthy();
  });

  it("returns profile for authenticated user", async () => {
    if (!dbReady) return;

    const { accessToken } = await loginViaHttp();

    const response = await app.handle(
      new Request("http://localhost/access/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { email: string };
    expect(body.email).toBe(userEmail);
  });

  it("rejects profile without auth", async () => {
    if (!dbReady) return;

    const response = await app.handle(
      new Request("http://localhost/access/profile")
    );

    expect(response.status).toBe(401);
  });

  it("refreshes session with refresh token in body (non-production)", async () => {
    if (!dbReady) return;

    const { refreshToken } = await loginViaHttp();
    expect(refreshToken).toBeTruthy();

    const response = await app.handle(
      new Request("http://localhost/access/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { session: { token: string } };
    expect(body.session.token.split(".")).toHaveLength(3);
  });

  it("logs out and invalidates session for subsequent profile access", async () => {
    if (!dbReady) return;

    const { accessToken } = await loginViaHttp();

    const logoutResponse = await app.handle(
      new Request("http://localhost/access/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    expect(logoutResponse.status).toBe(200);

    const profileResponse = await app.handle(
      new Request("http://localhost/access/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    expect(profileResponse.status).toBe(401);
  });
});
