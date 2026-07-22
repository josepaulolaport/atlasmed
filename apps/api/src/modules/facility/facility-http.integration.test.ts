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
import {
  professionals,
  facilityProfessionals,
  facilities,
  fileAssets,
  documentFiles,
  businessVerticals,
  facilityVerticalProfiles,
} from "@atlasmed/database";
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

describe("Facility HTTP auth integration", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: HttpIntegrationApp;
  let contextProfessionalId: string;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);
    app = createHttpIntegrationApp(access, facility, professional);
    await redis.flushdb();

    const professionalRecord = await db
      .insert(professionals)
      .values({
        firstName: "Facility",
        lastName: `Context ${uniqueId}`,
        taxId: "52998224725",
      })
      .returning()
      .then((r) => r[0]!);
    await db.insert(facilityProfessionals).values({
      facilityId: fixtures.inScopeFacilityId,
      professionalId: professionalRecord.id,
      confirmedAt: new Date(),
      isPartner: false,
    });
    contextProfessionalId = professionalRecord.id;
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

    const profIds = await db
      .select({ id: professionals.id })
      .from(professionals)
      .where(like(professionals.lastName, `%${fixtures.uniqueId}%`))
      .then((r) => r.map((p) => p.id));
    if (profIds.length > 0) {
      await db
        .delete(facilityProfessionals)
        .where(inArray(facilityProfessionals.professionalId, profIds));
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

  it("returns 401 for unauthenticated facility list", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const response = await authRequest(
      app,
      "http://localhost/api/v1/facilities",
      null
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when USER tries to create a facility", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

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
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

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

  it("validates facility purchase list filter and sort query combinations", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.admin.email);
    const invalidRelevance = await authRequest(
      app,
      "http://localhost/api/v1/facilities?sort=relevance",
      token
    );
    const invalidRange = await authRequest(
      app,
      "http://localhost/api/v1/facilities?purchaseIntervalMinDays=90&purchaseIntervalMaxDays=30",
      token
    );
    const valid = await authRequest(
      app,
      "http://localhost/api/v1/facilities?purchaseFunnelStage=NEVER_PURCHASED%2CCHURN&purchaseProfile=AUTOMATIC&purchaseIntervalMinDays=1&purchaseIntervalMaxDays=3650&sort=purchaseFunnelStage&order=desc",
      token
    );

    expect(invalidRelevance.status).toBe(400);
    expect(invalidRange.status).toBe(400);
    expect(valid.status).toBe(200);
  });

  it("scoped field USER can read in-territory facility", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}`,
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      id: string;
      name: string;
      streetAddress?: string | null;
      phone?: string | null;
      email?: string | null;
      website?: string | null;
      lat?: number;
      lng?: number;
      commercialStatus?: string;
      purchaseStatus?: string;
      conformityStatus?: string;
    };
    expect(body.id).toBe(fixtures.inScopeFacilityId);
    expect(body).toMatchObject({
      streetAddress: "Rua Teste",
      phone: "1133334444",
      email: `facility.in.${fixtures.uniqueId}@test.example.com`,
      website: "https://example.com/facility",
      lat: -23.5505,
      lng: -46.6333,
    });
    // purchaseStatus still mocked on mobile Sinais; commercial/conformity are live
    expect(body.purchaseStatus).toBeUndefined();
    expect(body.conformityStatus).toBeDefined();
  });

  it("scoped field USER gets 403 for out-of-territory facility", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.outOfScopeFacilityId}`,
      token
    );

    expect(response.status).toBe(403);
  });

  it("field USER facility list excludes out-of-scope facilities", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

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
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

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
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

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
          relationshipLevel: 8,
          notes: "Primary partner",
        }),
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      isPartner: boolean;
      relationshipLevel?: number;
      notes?: string;
    };
    expect(body.isPartner).toBe(true);
    expect(body.relationshipLevel).toBe(8);
    expect(body.notes).toBe("Primary partner");
  });

  it("rejects invalid relationship level on facility professional patch", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${fixtures.inScopeFacilityId}/professionals/${contextProfessionalId}`,
      token,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          relationshipLevel: 99,
        }),
      }
    );

    expect(response.status).toBe(400);
  });

  it("cadastro checklist filters by PF/PJ and flips statuses after approve + billing email", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const facilityId = fixtures.inScopeFacilityId;
    const [vertical] = await db
      .select({ id: businessVerticals.id })
      .from(businessVerticals)
      .where(eq(businessVerticals.isActive, true))
      .limit(1);
    if (!vertical) {
      throw new Error("No active business vertical found for integration test");
    }

    await db
      .insert(facilityVerticalProfiles)
      .values({
        facilityId,
        verticalId: vertical.id,
        commercialStatus: "REGISTERED",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [
          facilityVerticalProfiles.facilityId,
          facilityVerticalProfiles.verticalId,
        ],
        set: {
          commercialStatus: "REGISTERED",
          isActive: true,
          updatedAt: new Date(),
        },
      });

    await db
      .update(facilities)
      .set({
        taxIdType: "PJ",
        billingEmail: null,
        conformityStatus: "INCOMPLETE",
      })
      .where(eq(facilities.id, facilityId));

    const token = await loginToken(fixtures.admin.email);
    const checklistRes = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${facilityId}/cadastro`,
      token
    );
    expect(checklistRes.status).toBe(200);
    const checklist = (await checklistRes.json()) as {
      taxIdType?: string;
      documents: Array<{ slug: string; requirementId: string }>;
    };
    expect(checklist.taxIdType).toBe("PJ");
    const slugs = checklist.documents.map((d) => d.slug);
    expect(slugs).toContain("carta_cnpj");
    expect(slugs).toContain("licenca_sanitaria");
    expect(slugs).not.toContain("identidade");
    expect(slugs).not.toContain("crm");

    const documentIds: string[] = [];
    for (const doc of checklist.documents) {
      const draftRes = await authRequest(
        app,
        `http://localhost/api/v1/facilities/${facilityId}/cadastro/submissions`,
        token,
        { method: "POST" }
      );
      expect(draftRes.status).toBe(200);
      const draft = (await draftRes.json()) as { id: string };

      const createDocRes = await authRequest(
        app,
        `http://localhost/api/v1/facilities/${facilityId}/cadastro/submissions/${draft.id}/documents`,
        token,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ requirementId: doc.requirementId }),
        }
      );
      expect(createDocRes.status).toBe(200);
      const createdDoc = (await createDocRes.json()) as { id: string };

      const [asset] = await db
        .insert(fileAssets)
        .values({
          facilityId,
          bucket: "test-bucket",
          objectKey: `test/${facilityId}/${doc.requirementId}/${Date.now()}.png`,
          originalFilename: `${doc.slug}.png`,
          declaredMimeType: "image/png",
          detectedMimeType: "image/png",
          sizeBytes: 68,
          status: "READY",
          pageCount: 1,
          processedAt: new Date(),
        })
        .returning();
      await db.insert(documentFiles).values({
        submissionDocumentId: createdDoc.id,
        fileAssetId: asset!.id,
        position: 1,
        role: "PAGE",
      });

      const submitRes = await authRequest(
        app,
        `http://localhost/api/v1/facilities/${facilityId}/cadastro/requirements/${doc.requirementId}/submit`,
        token,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ documentId: createdDoc.id }),
        }
      );
      expect(submitRes.status).toBe(200);
      const submitted = (await submitRes.json()) as {
        documentId: string;
        status: string;
      };
      expect(submitted.status).toBe("UNDER_REVIEW");
      documentIds.push(submitted.documentId);
    }

    for (const documentId of documentIds) {
      const approveRes = await authRequest(
        app,
        `http://localhost/api/v1/facilities/${facilityId}/cadastro/documents/${documentId}/review`,
        token,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision: "APPROVED" }),
        }
      );
      expect(approveRes.status).toBe(200);
    }

    const emailRes = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${facilityId}/billing-email`,
      token,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "financeiro@clinica.test" }),
      }
    );
    expect(emailRes.status).toBe(200);
    const emailBody = (await emailRes.json()) as {
      complete: boolean;
      conformityStatus: string;
      commercialStatus: string | null;
    };
    expect(emailBody.complete).toBe(true);
    expect(emailBody.conformityStatus).toBe("COMPLETE");
    expect(emailBody.commercialStatus).toBe("ACTIVE");

    const facilityRes = await authRequest(
      app,
      `http://localhost/api/v1/facilities/${facilityId}`,
      token
    );
    expect(facilityRes.status).toBe(200);
    const facilityBody = (await facilityRes.json()) as {
      conformityStatus?: string;
      commercialStatus?: string;
      billingEmail?: string | null;
    };
    expect(facilityBody.conformityStatus).toBe("COMPLETE");
    expect(facilityBody.commercialStatus).toBe("ACTIVE");
    expect(facilityBody.billingEmail).toBe("financeiro@clinica.test");
  });
});
