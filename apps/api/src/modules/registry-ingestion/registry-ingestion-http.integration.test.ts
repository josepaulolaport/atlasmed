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
import { clinic } from "../clinic/index";
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
      app.use(access).use(clinic).use(registryIngestion)
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

  it("scoped MANAGER can approve suggestion for clinic in territory", async () => {
    if (!dbReady) return;

    const clinicRecord = await prisma.clinic.create({
      data: {
        name: `Registry Scope Clinic ${fixtures.uniqueId}`,
        territoryId: fixtures.territoryId,
      },
    });

    const run = await prisma.ingestionRun.create({
      data: { sourceProvider: "mock_registry", status: "COMPLETED" },
    });

    const suggestion = await prisma.ingestionSuggestion.create({
      data: {
        ingestionRunId: run.id,
        type: "CLINIC_REMOVAL",
        status: "PENDING",
        clinicId: clinicRecord.id,
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

    await prisma.clinic.delete({ where: { id: clinicRecord.id } }).catch(() => {});
    await prisma.ingestionRun.delete({ where: { id: run.id } }).catch(() => {});
  });

  it("returns 403 when MANAGER approves suggestion outside scope", async () => {
    if (!dbReady) return;

    const clinicRecord = await prisma.clinic.create({
      data: {
        name: `Out of Scope Clinic ${fixtures.uniqueId}`,
        territoryId: `other-territory-${fixtures.uniqueId}`,
      },
    });

    const run = await prisma.ingestionRun.create({
      data: { sourceProvider: "mock_registry", status: "COMPLETED" },
    });

    const suggestion = await prisma.ingestionSuggestion.create({
      data: {
        ingestionRunId: run.id,
        type: "CLINIC_REMOVAL",
        status: "PENDING",
        clinicId: clinicRecord.id,
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

    await prisma.clinic.delete({ where: { id: clinicRecord.id } }).catch(() => {});
    await prisma.ingestionRun.delete({ where: { id: run.id } }).catch(() => {});
  });

  it("returns 401 for unauthenticated clinic doctors list", async () => {
    if (!dbReady) return;

    const response = await authRequest(
      "http://localhost/api/v1/clinic/clinics/some-id/doctors",
      null
    );

    expect(response.status).toBe(401);
  });
});
