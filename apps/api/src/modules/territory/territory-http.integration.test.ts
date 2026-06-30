import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { Elysia } from "elysia";
import { HttpError } from "@atlasmed/access";
import { access } from "../access/index";
import { territory } from "../territory/index";
import { AppError } from "../../shared/errors";
import { prisma } from "../../infrastructure/database/prisma.client";
import { redis } from "../../infrastructure/cache/redis.client";
import { getUniqueTestId } from "../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../test-utils/integration-database";
import { accessUseCases } from "../access/composition";
import {
  cleanupScopeIntegrationFixtures,
  seedScopeIntegrationFixtures,
  type ScopeIntegrationFixtures,
} from "../access/test-helpers/scope-integration-fixtures";
import { scopeCacheService } from "../access/infrastructure/cache/scope-cache.service";

function createTerritoryHttpApp() {
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { error: error.toClientJSON() };
      }

      if (error instanceof HttpError) {
        set.status = error.statusCode;
        return { error: error.toJSON() };
      }

      set.status = 500;
      return {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    })
    .group("/api/v1", (app) => app.use(access).use(territory));
}

describe("Territory HTTP scope integration", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: ReturnType<typeof createTerritoryHttpApp>;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);
    app = createTerritoryHttpApp();
    await redis.flushdb();
  });

  beforeEach(async () => {
    if (!dbReady) return;
    await scopeCacheService.invalidateMany([
      fixtures.admin.id,
      fixtures.manager.id,
      fixtures.otherManager.id,
      fixtures.fieldUser.id,
      fixtures.otherUser.id,
    ]);
  });

  afterAll(async () => {
    if (!dbReady || !fixtures) return;
    await cleanupScopeIntegrationFixtures(fixtures.uniqueId);
  });

  async function loginToken(email: string): Promise<string> {
    const result = await accessUseCases.login().execute({
      identifier: email,
      password: fixtures.password,
    });

    if (!result.accessToken) {
      throw new Error("Expected access token from login");
    }

    return result.accessToken;
  }

  function authRequest(url: string, token: string | null, init?: RequestInit) {
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return app.handle(
      new Request(url, {
        ...init,
        headers,
      })
    );
  }

  it("manager territory list excludes out-of-scope patches", async () => {
    if (!dbReady) return;

    const managerToken = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      "http://localhost/api/v1/territory/territories?format=flat",
      managerToken
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }> };
    const ids = body.data.map((item) => item.id);

    expect(ids).toContain(fixtures.territoryId);
    expect(ids).not.toContain(fixtures.outOfScopeTerritoryId);
  });

  it("manager cannot read out-of-scope territory detail", async () => {
    if (!dbReady) return;

    const managerToken = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      `http://localhost/api/v1/territory/territories/${fixtures.outOfScopeTerritoryId}`,
      managerToken
    );

    expect(response.status).toBe(422);
  });

  it("manager cannot deactivate a non-leaf territory in jurisdiction", async () => {
    if (!dbReady) return;

    const region = await prisma.territory.findUnique({
      where: { id: fixtures.territoryId },
      select: { parentId: true },
    });

    expect(region?.parentId).toBeTruthy();

    const managerToken = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      `http://localhost/api/v1/territory/territories/${region!.parentId}`,
      managerToken,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false, reason: "test" }),
      }
    );

    expect(response.status).toBe(422);
  });

  it("manager can submit deactivate approval for in-scope leaf patch", async () => {
    if (!dbReady) return;

    const managerToken = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      `http://localhost/api/v1/territory/territories/${fixtures.territoryId}`,
      managerToken,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false, reason: "test_scope" }),
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { type: string; status: string };
    expect(body.type).toBe("deactivate_territory");
    expect(body.status).toBe("pending");
  });

  it("admin territory list includes all fixture territories", async () => {
    if (!dbReady) return;

    const adminToken = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      "http://localhost/api/v1/territory/territories?format=flat",
      adminToken
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }> };
    const ids = body.data.map((item) => item.id);

    expect(ids).toContain(fixtures.territoryId);
    expect(ids).toContain(fixtures.outOfScopeTerritoryId);
  });
});
