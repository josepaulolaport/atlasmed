import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { access } from "../access/index";
import { facility } from "../facility/index";
import { professional } from "../professional/index";
import { prisma } from "../../infrastructure/database/prisma.client";
import { redis } from "../../infrastructure/cache/redis.client";
import { getUniqueTestId } from "../../test-utils/database-helpers";
import { isIntegrationDatabaseReady } from "../../test-utils/integration-database";
import {
  authRequest,
  createHttpIntegrationApp,
  type HttpIntegrationApp,
} from "../../test-utils/http-integration-test";
import { accessUseCases } from "../access/composition";
import {
  cleanupScopeIntegrationFixtures,
  seedScopeIntegrationFixtures,
  type ScopeIntegrationFixtures,
} from "../access/test-helpers/scope-integration-fixtures";
import { scopeCacheService } from "../access/infrastructure/cache/scope-cache.service";

describe("Professional HTTP auth integration", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: HttpIntegrationApp;
  let inScopeProfessionalId: string;
  let outOfScopeProfessionalId: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);
    app = createHttpIntegrationApp(access, facility, professional);
    await redis.flushdb();

    const inScopeProfessional = await prisma.professional.create({
      data: {
        firstName: "In",
        lastName: `Scope ${uniqueId}`,
      },
    });
    await prisma.facilityProfessional.create({
      data: {
        facilityId: fixtures.inScopeFacilityId,
        professionalId: inScopeProfessional.id,
        confirmedAt: new Date(),
      },
    });
    inScopeProfessionalId = inScopeProfessional.id;

    const outOfScopeProfessional = await prisma.professional.create({
      data: {
        firstName: "Out",
        lastName: `Scope ${uniqueId}`,
      },
    });
    await prisma.facilityProfessional.create({
      data: {
        facilityId: fixtures.outOfScopeFacilityId,
        professionalId: outOfScopeProfessional.id,
        confirmedAt: new Date(),
      },
    });
    outOfScopeProfessionalId = outOfScopeProfessional.id;
  });

  beforeEach(async () => {
    if (!dbReady) return;
    await scopeCacheService.invalidateMany([
      fixtures.admin.id,
      fixtures.manager.id,
      fixtures.fieldUser.id,
    ]);
  });

  afterAll(async () => {
    if (!dbReady || !fixtures) return;

    await prisma.facilityProfessional.deleteMany({
      where: {
        professional: {
          lastName: { contains: fixtures.uniqueId },
        },
      },
    });
    await prisma.professional.deleteMany({
      where: {
        lastName: { contains: fixtures.uniqueId },
      },
    });
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

  it("returns 401 for unauthenticated professional list", async () => {
    if (!dbReady) return;

    const response = await authRequest(
      app,
      "http://localhost/api/v1/professionals",
      null
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when MANAGER tries to create a professional", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      app,
      "http://localhost/api/v1/professionals",
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: "Denied",
          lastName: `Manager ${fixtures.uniqueId}`,
        }),
      }
    );

    expect(response.status).toBe(403);
  });

  it("allows ADMIN to list professionals", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      app,
      "http://localhost/api/v1/professionals",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("scoped field USER can read in-scope professional", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/professionals/${inScopeProfessionalId}`,
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string };
    expect(body.id).toBe(inScopeProfessionalId);
  });

  it("scoped field USER gets 403 for out-of-scope professional", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/professionals/${outOfScopeProfessionalId}`,
      token
    );

    expect(response.status).toBe(403);
  });
});
