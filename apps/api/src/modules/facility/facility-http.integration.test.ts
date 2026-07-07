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

describe("Facility HTTP auth integration", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: HttpIntegrationApp;
  let contextProfessionalId: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) return;

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);
    app = createHttpIntegrationApp(access, facility, professional);
    await redis.flushdb();

    const professionalRecord = await prisma.professional.create({
      data: {
        firstName: "Facility",
        lastName: `Context ${uniqueId}`,
        taxId: "52998224725",
      },
    });
    await prisma.facilityProfessional.create({
      data: {
        facilityId: fixtures.inScopeFacilityId,
        professionalId: professionalRecord.id,
        confirmedAt: new Date(),
        isPartner: false,
      },
    });
    contextProfessionalId = professionalRecord.id;
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

  it("returns 401 for unauthenticated facility list", async () => {
    if (!dbReady) return;

    const response = await authRequest(
      app,
      "http://localhost/api/v1/facilities",
      null
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when USER tries to create a facility", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      "http://localhost/api/v1/facilities",
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `Denied Facility ${fixtures.uniqueId}`,
        }),
      }
    );

    expect(response.status).toBe(403);
  });

  it("allows ADMIN to list facilities", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities?search=${encodeURIComponent(`Scope Facility In ${fixtures.uniqueId}`)}`,
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((row) => row.id === fixtures.inScopeFacilityId)).toBe(
      true
    );
  });

  it("scoped field USER can read in-territory facility", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}`,
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string };
    expect(body.id).toBe(fixtures.inScopeFacilityId);
  });

  it("scoped field USER gets 403 for out-of-territory facility", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.outOfScopeFacilityId}`,
      token
    );

    expect(response.status).toBe(403);
  });

  it("field USER facility list excludes out-of-scope facilities", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      "http://localhost/api/v1/facilities",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: string }> };
    const ids = body.data.map((row) => row.id);
    expect(ids).toContain(fixtures.inScopeFacilityId);
    expect(ids).not.toContain(fixtures.outOfScopeFacilityId);
  });

  it("scoped field USER can read facility professional context", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/professionals/${contextProfessionalId}`,
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      professional: { id: string; taxId?: string };
      association: { facilityId: string };
    };
    expect(body.professional.id).toBe(contextProfessionalId);
    expect(body.professional.taxId).toBe("52998224725");
    expect(body.association.facilityId).toBe(fixtures.inScopeFacilityId);
  });

  it("allows ADMIN to patch facility professional role flags", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/professionals/${contextProfessionalId}`,
      token,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          isPartner: true,
          relationshipLevel: "HIGH",
          notes: "Primary partner",
        }),
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      isPartner: boolean;
      relationshipLevel?: string;
      notes?: string;
    };
    expect(body.isPartner).toBe(true);
    expect(body.relationshipLevel).toBe("HIGH");
    expect(body.notes).toBe("Primary partner");
  });

  it("rejects invalid relationship level on facility professional patch", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/professionals/${contextProfessionalId}`,
      token,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          relationshipLevel: "INVALID",
        }),
      }
    );

    expect(response.status).toBe(400);
  });
});
