import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { access } from "./index";
import { redis } from "../../infrastructure/cache/redis.client";
import { getUniqueTestId } from "../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../test-utils/integration-database";
import {
  authRequest,
  createHttpIntegrationApp,
  type HttpIntegrationApp,
} from "../../test-utils/http-integration-test";
import { accessUseCases } from "./composition";
import {
  cleanupScopeIntegrationFixtures,
  seedScopeIntegrationFixtures,
  type ScopeIntegrationFixtures,
} from "./test-helpers/scope-integration-fixtures";
import { scopeCacheService } from "./infrastructure/cache/scope-cache.service";

describe("Access HTTP auth integration", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: HttpIntegrationApp;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);
    app = createHttpIntegrationApp(access);
    await redis.flushdb();
  });

  beforeEach(async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");
    await scopeCacheService.invalidateMany([
      fixtures.admin.id,
      fixtures.manager.id,
      fixtures.fieldUser.id,
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

  it("returns 401 for unauthenticated user list", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const response = await authRequest(
      app,
      "http://localhost/api/v1/access/users",
      null
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when USER lists users", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      "http://localhost/api/v1/access/users",
      token
    );

    expect(response.status).toBe(403);
  });

  it("allows MANAGER to list users", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      app,
      "http://localhost/api/v1/access/users",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns the authenticated typed capability snapshot", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      app,
      "http://localhost/api/v1/user/capabilities",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      version: number;
      capabilities: Array<{ resource: string; actions: string[] }>;
    };
    expect(body).toEqual(
      expect.objectContaining({
        version: 2,
        capabilities: expect.arrayContaining([
          {
            resource: "agenda",
            actions: expect.arrayContaining(["read"]),
          },
          {
            resource: "facility",
            actions: expect.arrayContaining(["update"]),
          },
        ]),
      })
    );
  });

  it("returns 401 for an unauthenticated capability snapshot request", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/v1/user/capabilities"),
    );

    expect(response.status).toBe(401);
  });
});
