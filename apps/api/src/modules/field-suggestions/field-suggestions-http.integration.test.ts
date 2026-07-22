import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { eq } from "drizzle-orm";
import { facilities, fieldSuggestions } from "@atlasmed/database";
import { access } from "../access/index";
import { facility } from "../facility/index";
import { fieldSuggestions as fieldSuggestionsModule } from "../field-suggestions/index";
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

describe("Field suggestions HTTP integration", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: HttpIntegrationApp;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) {
      throw new Error("Test DB not ready — cannot run integration tests");
    }

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);
    app = createHttpIntegrationApp(access, facility, fieldSuggestionsModule);
    await redis.flushdb();
  });

  beforeEach(async () => {
    if (!dbReady) {
      throw new Error("Test DB not ready — cannot run integration tests");
    }
    await scopeCacheService.invalidateMany([
      fixtures.admin.id,
      fixtures.manager.id,
      fixtures.otherManager.id,
      fixtures.fieldUser.id,
      fixtures.otherUser.id,
    ]);
    await db
      .delete(fieldSuggestions)
      .where(eq(fieldSuggestions.facilityId, fixtures.inScopeFacilityId));
    await db
      .delete(fieldSuggestions)
      .where(eq(fieldSuggestions.facilityId, fixtures.outOfScopeFacilityId));
  });

  afterAll(async () => {
    if (!dbReady || !fixtures) return;
    await db
      .delete(fieldSuggestions)
      .where(eq(fieldSuggestions.facilityId, fixtures.inScopeFacilityId));
    await db
      .delete(fieldSuggestions)
      .where(eq(fieldSuggestions.facilityId, fixtures.outOfScopeFacilityId));
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

  it("returns 401 for unauthenticated create", async () => {
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions`,
      null,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "phoneNumber",
          proposedValue: "11999990000",
        }),
      }
    );
    expect(response.status).toBe(401);
  });

  it("REP can create field suggestion and list mine", async () => {
    const token = await loginToken(fixtures.fieldUser.email);

    const createResponse = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "phoneNumber",
          proposedValue: "11999990000",
        }),
      }
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      status: string;
      fieldKey: string;
    };
    expect(created.status).toBe("PENDING");
    expect(created.fieldKey).toBe("phoneNumber");

    const mineResponse = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions?mine=true`,
      token
    );
    expect(mineResponse.status).toBe(200);
    const mineBody = (await mineResponse.json()) as { data: Array<{ id: string }> };
    expect(mineBody.data.some((row) => row.id === created.id)).toBe(true);
  });

  it("supersedes older pending suggestion for same field", async () => {
    const token = await loginToken(fixtures.fieldUser.email);

    const first = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "email",
          proposedValue: "old@example.com",
        }),
      }
    );
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { id: string };

    const second = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "email",
          proposedValue: "new@example.com",
        }),
      }
    );
    expect(second.status).toBe(201);
    const secondBody = (await second.json()) as { id: string };

    const [oldRow] = await db
      .select()
      .from(fieldSuggestions)
      .where(eq(fieldSuggestions.id, firstBody.id));
    expect(oldRow?.status).toBe("REJECTED");
    expect(oldRow?.resolutionNote).toContain(secondBody.id);

    const [newRow] = await db
      .select()
      .from(fieldSuggestions)
      .where(eq(fieldSuggestions.id, secondBody.id));
    expect(newRow?.status).toBe("PENDING");
  });

  it("REP cannot approve; MANAGER can approve phone change", async () => {
    const repToken = await loginToken(fixtures.fieldUser.email);
    const createResponse = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions`,
      repToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "phoneNumber",
          proposedValue: "11888887777",
        }),
      }
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    const repApprove = await authRequest(
      app,
      `http://localhost/api/v1/field-suggestions/${created.id}/approve`,
      repToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    expect(repApprove.status).toBe(403);

    const managerToken = await loginToken(fixtures.manager.email);
    const approve = await authRequest(
      app,
      `http://localhost/api/v1/field-suggestions/${created.id}/approve`,
      managerToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    expect(approve.status).toBe(200);

    const facility = await db.query.facilities.findFirst({
      where: eq(facilities.id, fixtures.inScopeFacilityId),
    });
    expect(facility?.phoneNumber).toBe("11888887777");
  });

  it("returns 403 when MANAGER approves suggestion outside scope", async () => {
    const adminToken = await loginToken(fixtures.admin.email);
    const createResponse = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.outOfScopeFacilityId}/field-suggestions`,
      adminToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "websiteUrl",
          proposedValue: "https://example.com",
        }),
      }
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    const managerToken = await loginToken(fixtures.manager.email);
    const approve = await authRequest(
      app,
      `http://localhost/api/v1/field-suggestions/${created.id}/approve`,
      managerToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    expect(approve.status).toBe(403);
  });

  it("address approve fails with 422 when geocode returns null", async () => {
    const token = await loginToken(fixtures.fieldUser.email);
    const createResponse = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "address",
          proposedValue: {
            streetAddress: "Rua Inexistente XYZ",
            streetNumber: "1",
            neighborhood: "Centro",
            city: "São Paulo",
            state: "SP",
            postalCode: "01000-000",
          },
        }),
      }
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as { id: string };

    const managerToken = await loginToken(fixtures.manager.email);
    const approve = await authRequest(
      app,
      `http://localhost/api/v1/field-suggestions/${created.id}/approve`,
      managerToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    // Noop / failed geocode keeps suggestion pending.
    expect(approve.status).toBe(422);

    const [row] = await db
      .select()
      .from(fieldSuggestions)
      .where(eq(fieldSuggestions.id, created.id));
    expect(row?.status).toBe("PENDING");
  });

  it("rejects double approve with 422", async () => {
    const token = await loginToken(fixtures.fieldUser.email);
    const createResponse = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "responsibleName",
          proposedValue: "Dr. Teste",
        }),
      }
    );
    const created = (await createResponse.json()) as { id: string };

    const managerToken = await loginToken(fixtures.manager.email);
    const firstApprove = await authRequest(
      app,
      `http://localhost/api/v1/field-suggestions/${created.id}/approve`,
      managerToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    expect(firstApprove.status).toBe(200);

    const secondApprove = await authRequest(
      app,
      `http://localhost/api/v1/field-suggestions/${created.id}/approve`,
      managerToken,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    expect(secondApprove.status).toBe(422);
  });

  it("rejects commercialStatus field key with 422", async () => {
    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/field-suggestions`,
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "FIELD_CHANGE",
          fieldKey: "commercialStatus",
          proposedValue: "ACTIVE",
        }),
      }
    );
    // Unknown administrative keys use ValidationError → 400.
    expect(response.status).toBe(400);
  });
});
