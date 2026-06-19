import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { hash } from "argon2";
import { access } from "../access";
import { explore } from "./index";
import { AppError } from "../../shared/errors";
import { prisma } from "../../infrastructure/database/prisma.client";
import { redis } from "../../infrastructure/cache/redis.client";
import { getUniqueTestId } from "../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../test-utils/integration-database";
import { isMcpTestSchemaReady } from "../../test-utils/mcp-test-database";

const TEST_PASSWORD = "Password123!";

function createExploreIntegrationApp() {
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
    .use(access)
    .use(explore);
}

describe("Explore HTTP Integration Tests", () => {
  let dbReady = false;
  let mcpReady = false;
  let app: ReturnType<typeof createExploreIntegrationApp>;
  let userId: string;
  let userEmail: string;
  let accessToken: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    mcpReady = await isMcpTestSchemaReady();
    if (!mcpReady) return;

    app = createExploreIntegrationApp();
    await redis.flushdb();

    const uniqueId = getUniqueTestId();
    userEmail = `explore.http.${uniqueId}@test.example.com`;

    const userRole = await prisma.role.findUnique({ where: { name: "USER" } });
    if (!userRole) {
      throw new Error("USER role not found in seeded database");
    }

    const user = await prisma.user.create({
      data: {
        email: userEmail,
        username: `explore_http_${uniqueId}`,
        passwordHash: await hash(TEST_PASSWORD),
        roleId: userRole.id,
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    userId = user.id;

    const loginResponse = await app.handle(
      new Request("http://localhost/access/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: userEmail,
          password: TEST_PASSWORD,
        }),
      }),
    );

    expect(loginResponse.status).toBe(200);
    const loginBody = (await loginResponse.json()) as {
      session: { token: string };
      refreshToken?: string;
    };

    accessToken = loginBody.session.token;
    expect(accessToken.split(".")).toHaveLength(3);
    expect(loginBody.refreshToken).toBeTruthy();
  });

  afterAll(async () => {
    if (!dbReady) return;
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("rejects unauthenticated facility list", async () => {
    if (!dbReady || !mcpReady) return;

    const response = await app.handle(
      new Request("http://localhost/explore/facilities?search=SAMARITANO"),
    );

    expect(response.status).toBe(401);
  });

  it("returns facilities from mcp_test when browsing without search", async () => {
    if (!dbReady || !mcpReady) return;

    const response = await app.handle(
      new Request("http://localhost/explore/facilities?page=1&limit=5", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: Array<{ facilityId: string; professionalCount: number }>;
      pagination: { page: number; limit: number };
    };

    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]?.professionalCount ?? 0).toBeGreaterThan(0);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(5);
  });

  it(
    "returns facilities from mcp_test when searching",
    async () => {
      if (!dbReady || !mcpReady) return;

      const response = await app.handle(
        new Request(
          "http://localhost/explore/facilities?page=1&limit=5&search=SAMARITANO",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      );

      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        data: Array<{ facilityId: string; tradeName: string | null; cnesCode: string | null }>;
        pagination: { page: number; limit: number };
      };

      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0]?.facilityId).toBeTruthy();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(5);
    },
    { timeout: 60_000 },
  );

  it(
    "returns facility detail with professionals array",
    async () => {
      if (!dbReady || !mcpReady) return;

      const listResponse = await app.handle(
        new Request(
          "http://localhost/explore/facilities?page=1&limit=1&search=SAMARITANO",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      );

      const listBody = (await listResponse.json()) as {
        data: Array<{ facilityId: string }>;
      };

      const facilityId = listBody.data[0]?.facilityId;
      expect(facilityId).toBeTruthy();
      if (!facilityId) return;

      const detailResponse = await app.handle(
        new Request(`http://localhost/explore/facilities/${facilityId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      expect(detailResponse.status).toBe(200);

      const detail = (await detailResponse.json()) as {
        facilityId: string;
        professionals?: unknown[];
        municipalityName: string | null;
      };

      expect(detail.facilityId).toBe(facilityId);
      expect(Array.isArray(detail.professionals)).toBe(true);
    },
    { timeout: 90_000 },
  );

  it(
    "returns professional detail by id from linked facility",
    async () => {
      if (!dbReady || !mcpReady) return;

      const listResponse = await app.handle(
        new Request(
          "http://localhost/explore/facilities?page=1&limit=1&search=SAMARITANO",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      );

      const listBody = (await listResponse.json()) as {
        data: Array<{ facilityId: string }>;
      };

      const facilityId = listBody.data[0]?.facilityId;
      expect(facilityId).toBeTruthy();
      if (!facilityId) return;

      const facilityResponse = await app.handle(
        new Request(`http://localhost/explore/facilities/${facilityId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      const facility = (await facilityResponse.json()) as {
        professionals?: Array<{ professionalId: string; fullName: string }>;
      };

      const professionalId = facility.professionals?.[0]?.professionalId;
      if (!professionalId) return;

      const response = await app.handle(
        new Request(`http://localhost/explore/professionals/${professionalId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        professionalId: string;
        fullName: string;
        facilityLinks?: unknown[];
      };

      expect(body.professionalId).toBe(professionalId);
      expect(body.fullName).toBeTruthy();
      expect(Array.isArray(body.facilityLinks)).toBe(true);
    },
    { timeout: 90_000 },
  );
});
