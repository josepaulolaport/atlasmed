import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "bun:test";
import { Elysia } from "elysia";
import { access } from "./index";
import { AppError } from "../../shared/errors";
import { prisma } from "../../infrastructure/database/prisma.client";
import { redis } from "../../infrastructure/cache/redis.client";
import { getUniqueTestId } from "../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../test-utils/integration-database";
import type { LoginUseCase } from "./application/use-cases/login.use-case";
import { accessUseCases } from "./composition";
import {
  cleanupScopeIntegrationFixtures,
  seedScopeIntegrationFixtures,
  type ScopeIntegrationFixtures,
} from "./test-helpers/scope-integration-fixtures";

function createIntegrationApp() {
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

describe("Access Scope and Assignments Integration Tests", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: ReturnType<typeof createIntegrationApp>;
  let loginUseCase: LoginUseCase;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);

    loginUseCase = accessUseCases.login();

    app = createIntegrationApp();
    await redis.flushdb();
  });

  afterAll(async () => {
    if (!dbReady || !fixtures) return;
    await cleanupScopeIntegrationFixtures(fixtures.uniqueId);
  });

  async function loginToken(email: string): Promise<string> {
    const result = await loginUseCase.execute({
      identifier: email,
      password: fixtures.password,
    });

    if (!result.accessToken) {
      throw new Error("Expected access token from login");
    }

    return result.accessToken;
  }

  function authRequest(url: string, token: string, init?: RequestInit) {
    return app.handle(
      new Request(url, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${token}`,
        },
      })
    );
  }

  it("ADMIN lists all scope fixture users", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      "http://localhost/access/users?limit=100",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ email: string }> };
    const emails = body.data.map((u) => u.email);

    expect(emails).toContain(fixtures.admin.email);
    expect(emails).toContain(fixtures.manager.email);
    expect(emails).toContain(fixtures.fieldUser.email);
    expect(emails).toContain(fixtures.otherUser.email);
  });

  it("MANAGER list is scoped to managed field user with territory", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      "http://localhost/access/users?limit=100",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ email: string }> };
    const emails = body.data.map((u) => u.email);

    expect(emails).toContain(fixtures.fieldUser.email);
    expect(emails).not.toContain(fixtures.otherUser.email);
  });

  it("MANAGER cannot read assignments", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      `http://localhost/access/users/${fixtures.fieldUser.id}/assignments`,
      token
    );

    expect(response.status).toBe(403);
  });

  it("MANAGER can suspend managed field user", async () => {
    if (!dbReady) return;

    await prisma.user.update({
      where: { id: fixtures.fieldUser.id },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        managerId: fixtures.manager.id,
      },
    });

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      `http://localhost/access/users/${fixtures.fieldUser.id}/suspend`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(response.status).toBe(200);
  });

  it("MANAGER cannot suspend user outside their management scope", async () => {
    if (!dbReady) return;

    await prisma.user.update({
      where: { id: fixtures.otherUser.id },
      data: { status: "ACTIVE", suspendedAt: null },
    });

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      `http://localhost/access/users/${fixtures.otherUser.id}/suspend`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(response.status).toBe(403);
  });

  it("ADMIN reads assignments and performs manager/territory CRUD", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const newTerritory = fixtures.extraTerritoryId;

    let response = await authRequest(
      `http://localhost/access/users/${fixtures.fieldUser.id}/assignments`,
      token
    );
    expect(response.status).toBe(200);
    let assignments = (await response.json()) as {
      isOperationallyActive?: boolean;
      managerId?: string | null;
      territories: Array<{ territoryId: string }>;
    };
    expect(assignments.isOperationallyActive).toBe(true);
    expect(assignments.territories.some((t) => t.territoryId === fixtures.territoryId)).toBe(
      true
    );

    response = await authRequest(
      `http://localhost/access/users/${fixtures.fieldUser.id}/manager`,
      token,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ managerId: fixtures.otherManager.id }),
      }
    );
    expect(response.status).toBe(200);

    response = await authRequest(
      `http://localhost/access/users/${fixtures.fieldUser.id}/territories`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ territoryId: newTerritory }),
      }
    );
    expect(response.status).toBe(200);

    response = await authRequest(
      `http://localhost/access/users/${fixtures.fieldUser.id}/assignments`,
      token
    );
    assignments = (await response.json()) as typeof assignments;
    expect(assignments.managerId).toBe(fixtures.otherManager.id);
    expect(assignments.territories.some((t) => t.territoryId === newTerritory)).toBe(true);

    response = await authRequest(
      `http://localhost/access/users/${fixtures.fieldUser.id}/territories/${encodeURIComponent(newTerritory)}`,
      token,
      { method: "DELETE" }
    );
    expect(response.status).toBe(200);

    response = await authRequest(
      `http://localhost/access/users/${fixtures.fieldUser.id}/assignments`,
      token
    );
    assignments = (await response.json()) as {
      territories: Array<{ territoryId: string }>;
      isOperationallyActive: boolean;
    };
    expect(assignments.territories.some((t) => t.territoryId === newTerritory)).toBe(false);
    expect(assignments.isOperationallyActive).toBe(true);
  });
});
