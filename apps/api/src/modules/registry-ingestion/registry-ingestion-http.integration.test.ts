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
import { eq } from "drizzle-orm";
import { facilities, ingestionRuns, ingestionSuggestions } from "@atlasmed/database";
import { db } from "../../infrastructure/database/db";
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

    const clinicRecord = await db
      .insert(facilities)
      .values({
        displayName: `Registry Scope Facility ${fixtures.uniqueId}`,
        territoryId: fixtures.territoryId,
      })
      .returning()
      .then((r) => r[0]!);

    const run = await db
      .insert(ingestionRuns)
      .values({ sourceProvider: "mock_registry", status: "COMPLETED" })
      .returning()
      .then((r) => r[0]!);

    const suggestion = await db
      .insert(ingestionSuggestions)
      .values({
        ingestionRunId: run.id,
        type: "FACILITY_REGISTRY_DEACTIVATED",
        status: "PENDING",
        facilityId: clinicRecord.id,
        reason: "test_scope",
      })
      .returning()
      .then((r) => r[0]!);

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

    await db.delete(facilities).where(eq(facilities.id, clinicRecord.id)).catch(() => {});
    await db.delete(ingestionRuns).where(eq(ingestionRuns.id, run.id)).catch(() => {});
  });

  it("MANAGER list only returns suggestions for facilities in scope", async () => {
    if (!dbReady) return;

    const inScopeFacility = await db
      .insert(facilities)
      .values({
        displayName: `In Scope Facility ${fixtures.uniqueId}`,
        territoryId: fixtures.territoryId,
      })
      .returning()
      .then((r) => r[0]!);

    const outOfScopeFacility = await db
      .insert(facilities)
      .values({
        displayName: `Out of Scope Facility ${fixtures.uniqueId}`,
        territoryId: fixtures.outOfScopeTerritoryId,
      })
      .returning()
      .then((r) => r[0]!);

    const run = await db
      .insert(ingestionRuns)
      .values({ sourceProvider: "mock_registry", status: "COMPLETED" })
      .returning()
      .then((r) => r[0]!);

    const inScopeSuggestion = await db
      .insert(ingestionSuggestions)
      .values({
        ingestionRunId: run.id,
        type: "FACILITY_REGISTRY_DEACTIVATED",
        status: "PENDING",
        facilityId: inScopeFacility.id,
        reason: "test_in_scope",
      })
      .returning()
      .then((r) => r[0]!);

    const outOfScopeSuggestion = await db
      .insert(ingestionSuggestions)
      .values({
        ingestionRunId: run.id,
        type: "FACILITY_REGISTRY_DEACTIVATED",
        status: "PENDING",
        facilityId: outOfScopeFacility.id,
        reason: "test_out_of_scope_list",
      })
      .returning()
      .then((r) => r[0]!);

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

    await db.delete(facilities).where(eq(facilities.id, inScopeFacility.id)).catch(() => {});
    await db.delete(facilities).where(eq(facilities.id, outOfScopeFacility.id)).catch(() => {});
    await db.delete(ingestionRuns).where(eq(ingestionRuns.id, run.id)).catch(() => {});
  });

  it("returns 403 when MANAGER approves suggestion outside scope", async () => {
    if (!dbReady) return;

    const clinicRecord = await db
      .insert(facilities)
      .values({
        displayName: `Out of Scope Facility ${fixtures.uniqueId}`,
        territoryId: fixtures.outOfScopeTerritoryId,
      })
      .returning()
      .then((r) => r[0]!);

    const run = await db
      .insert(ingestionRuns)
      .values({ sourceProvider: "mock_registry", status: "COMPLETED" })
      .returning()
      .then((r) => r[0]!);

    const suggestion = await db
      .insert(ingestionSuggestions)
      .values({
        ingestionRunId: run.id,
        type: "FACILITY_REGISTRY_DEACTIVATED",
        status: "PENDING",
        facilityId: clinicRecord.id,
        reason: "test_out_of_scope",
      })
      .returning()
      .then((r) => r[0]!);

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

    await db.delete(facilities).where(eq(facilities.id, clinicRecord.id)).catch(() => {});
    await db.delete(ingestionRuns).where(eq(ingestionRuns.id, run.id)).catch(() => {});
  });

  it("allows ADMIN to list registry ingestion runs with phase fields", async () => {
    if (!dbReady) return;

    const run = await db
      .insert(ingestionRuns)
      .values({
        sourceProvider: "cnes",
        status: "RUNNING",
        phase: "LOADING",
        referenceAno: 2026,
        referenceMes: 6,
        temporalWorkflowId: "cnes-ingestion-2026-06",
      })
      .returning()
      .then((r) => r[0]!);

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      "http://localhost/api/v1/registry-ingestion/runs",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ id: string; phase: string | null; referenceAno: number | null }>;
    };
    const listed = body.data.find((item) => item.id === run.id);
    expect(listed?.phase).toBe("LOADING");
    expect(listed?.referenceAno).toBe(2026);

    const statusResponse = await authRequest(
      `http://localhost/api/v1/registry-ingestion/runs/${run.id}/status`,
      token
    );
    expect(statusResponse.status).toBe(200);
    const statusBody = (await statusResponse.json()) as {
      run: { id: string; temporalWorkflowId: string | null };
    };
    expect(statusBody.run.id).toBe(run.id);
    expect(statusBody.run.temporalWorkflowId).toBe("cnes-ingestion-2026-06");

    await db.delete(ingestionRuns).where(eq(ingestionRuns.id, run.id));
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
