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
import { eq, like, inArray } from "drizzle-orm";
import { professionals, facilityProfessional } from "@atlasmed/database";
import { db } from "../../infrastructure/database/db";
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

    const inScopeProfessional = await db
      .insert(professionals)
      .values({ firstName: "In", lastName: `Scope ${uniqueId}` })
      .returning()
      .then((r) => r[0]!);
    await db.insert(facilityProfessional).values({
      facilityId: fixtures.inScopeFacilityId,
      professionalId: inScopeProfessional.id,
      confirmedAt: new Date(),
    });
    inScopeProfessionalId = inScopeProfessional.id;

    const outOfScopeProfessional = await db
      .insert(professionals)
      .values({ firstName: "Out", lastName: `Scope ${uniqueId}` })
      .returning()
      .then((r) => r[0]!);
    await db.insert(facilityProfessional).values({
      facilityId: fixtures.outOfScopeFacilityId,
      professionalId: outOfScopeProfessional.id,
      confirmedAt: new Date(),
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

    const profIds = await db
      .select({ id: professionals.id })
      .from(professionals)
      .where(like(professionals.lastName, `%${fixtures.uniqueId}%`))
      .then((r) => r.map((p) => p.id));
    if (profIds.length > 0) {
      await db
        .delete(facilityProfessional)
        .where(inArray(facilityProfessional.professionalId, profIds));
    }
    await db
      .delete(professionals)
      .where(like(professionals.lastName, `%${fixtures.uniqueId}%`));
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

  it("allows ADMIN to update professional profile with CRM fields", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/professionals/${inScopeProfessionalId}`,
      token,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taxId: "52998224725",
          mobilePhone: "11999998888",
          crmNumber: "123456",
          crmState: "SP",
        }),
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      taxId?: string;
      mobilePhone?: string;
      crmNumber?: string;
      crmState?: string;
    };
    expect(body.taxId).toBe("52998224725");
    expect(body.mobilePhone).toBe("11999998888");
    expect(body.crmNumber).toBe("123456");
    expect(body.crmState).toBe("SP");
  });

  it("rejects invalid CPF on professional create", async () => {
    if (!dbReady) return;

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      app,
      "http://localhost/api/v1/professionals",
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: "Invalid",
          lastName: `CPF ${fixtures.uniqueId}`,
          taxId: "11111111111",
        }),
      }
    );

    expect(response.status).toBe(400);
  });
});
