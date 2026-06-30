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
import { facility } from "../facility/index";
import { registryIngestion } from "../registry-ingestion/index";
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
import { cleanupMockRegistryData } from "../registry-ingestion/test-helpers/registry-test-factory";
import { scopeCacheService } from "../access/infrastructure/cache/scope-cache.service";

function createRegistryHttpApp() {
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
    .group("/api/v1", (app) =>
      app.use(access).use(facility).use(registryIngestion)
    );
}

describe("Registry Ingestion HTTP Integration Tests", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: ReturnType<typeof createRegistryHttpApp>;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);
    app = createRegistryHttpApp();
    await redis.flushdb();
  });

  beforeEach(async () => {
    if (!dbReady) return;
    await cleanupMockRegistryData();
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
    await cleanupMockRegistryData();
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

  it("returns 401 for unauthenticated registry suggestions list", async () => {
    if (!dbReady) return;

    const response = await authRequest(
      "http://localhost/api/v1/registry-suggestions",
      null
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when USER tries to run ingestion", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      "http://localhost/api/v1/registry-ingestion/run",
      token,
      { method: "POST" }
    );

    expect(response.status).toBe(403);
  });

  it("allows ADMIN to list registry suggestions", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      "http://localhost/api/v1/registry-suggestions",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("scoped MANAGER can approve suggestion for facility in territory", async () => {
    if (!dbReady) return;

    const clinicRecord = await prisma.facility.create({
      data: {
        displayName: `Registry Scope Facility ${fixtures.uniqueId}`,
        territoryId: fixtures.territoryId,
      },
    });

    const run = await prisma.ingestionRun.create({
      data: { sourceProvider: "mock_registry", status: "COMPLETED" },
    });

    const suggestion = await prisma.ingestionSuggestion.create({
      data: {
        ingestionRunId: run.id,
        type: "FACILITY_REGISTRY_DEACTIVATED",
        status: "PENDING",
        facilityId: clinicRecord.id,
        reason: "test_scope",
      },
    });

    const managerToken = await loginToken(fixtures.manager.email);
    const approveResponse = await authRequest(
      `http://localhost/api/v1/registry-suggestions/${suggestion.id}/approve`,
      managerToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(approveResponse.status).toBe(200);

    await prisma.facility.delete({ where: { id: clinicRecord.id } }).catch(() => {});
    await prisma.ingestionRun.delete({ where: { id: run.id } }).catch(() => {});
  });

  it("MANAGER list only returns suggestions for facilities in scope", async () => {
    if (!dbReady) return;

    const inScopeFacility = await prisma.facility.create({
      data: {
        displayName: `In Scope Facility ${fixtures.uniqueId}`,
        territoryId: fixtures.territoryId,
      },
    });

    const outOfScopeFacility = await prisma.facility.create({
      data: {
        displayName: `Out of Scope Facility ${fixtures.uniqueId}`,
        territoryId: fixtures.outOfScopeTerritoryId,
      },
    });

    const run = await prisma.ingestionRun.create({
      data: { sourceProvider: "mock_registry", status: "COMPLETED" },
    });

    const inScopeSuggestion = await prisma.ingestionSuggestion.create({
      data: {
        ingestionRunId: run.id,
        type: "FACILITY_REGISTRY_DEACTIVATED",
        status: "PENDING",
        facilityId: inScopeFacility.id,
        reason: "test_in_scope",
      },
    });

    const outOfScopeSuggestion = await prisma.ingestionSuggestion.create({
      data: {
        ingestionRunId: run.id,
        type: "FACILITY_REGISTRY_DEACTIVATED",
        status: "PENDING",
        facilityId: outOfScopeFacility.id,
        reason: "test_out_of_scope_list",
      },
    });

    const managerToken = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      "http://localhost/api/v1/registry-suggestions?status=PENDING",
      managerToken
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }> };
    const ids = body.data.map((item) => item.id);

    expect(ids).toContain(inScopeSuggestion.id);
    expect(ids).not.toContain(outOfScopeSuggestion.id);

    await prisma.facility.delete({ where: { id: inScopeFacility.id } }).catch(() => {});
    await prisma.facility
      .delete({ where: { id: outOfScopeFacility.id } })
      .catch(() => {});
    await prisma.ingestionRun.delete({ where: { id: run.id } }).catch(() => {});
  });

  it("returns 403 when MANAGER approves suggestion outside scope", async () => {
    if (!dbReady) return;

    const clinicRecord = await prisma.facility.create({
      data: {
        displayName: `Out of Scope Facility ${fixtures.uniqueId}`,
        territoryId: fixtures.outOfScopeTerritoryId,
      },
    });

    const run = await prisma.ingestionRun.create({
      data: { sourceProvider: "mock_registry", status: "COMPLETED" },
    });

    const suggestion = await prisma.ingestionSuggestion.create({
      data: {
        ingestionRunId: run.id,
        type: "FACILITY_REGISTRY_DEACTIVATED",
        status: "PENDING",
        facilityId: clinicRecord.id,
        reason: "test_out_of_scope",
      },
    });

    const managerToken = await loginToken(fixtures.otherManager.email);
    const response = await authRequest(
      `http://localhost/api/v1/registry-suggestions/${suggestion.id}/approve`,
      managerToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    expect(response.status).toBe(403);

    await prisma.facility.delete({ where: { id: clinicRecord.id } }).catch(() => {});
    await prisma.ingestionRun.delete({ where: { id: run.id } }).catch(() => {});
  });

  it("returns 401 for unauthenticated clinic doctors list", async () => {
    if (!dbReady) return;

    const response = await authRequest(
      "http://localhost/api/v1/facilities/some-id/professionals",
      null
    );

    expect(response.status).toBe(401);
  });
});
