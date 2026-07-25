import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { HttpError } from "@atlasmed/access";
import { competitorProducts, products, businessVerticals } from "@atlasmed/database";
import { access } from "../access/index";
import { catalog } from "../catalog/index";
import { AppError } from "../../shared/errors";
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
import { scopeCacheService } from "../access/infrastructure/cache/scope-cache.service";

function createCatalogHttpApp() {
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
    .group("/api/v1", (app) => app.use(access).use(catalog));
}

describe("Catalog HTTP auth integration", () => {
  let dbReady = false;
  let fixtures: ScopeIntegrationFixtures;
  let app: ReturnType<typeof createCatalogHttpApp>;

  beforeAll(async () => {
    dbReady = await isIntegrationDatabaseReady();
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const uniqueId = getUniqueTestId();
    fixtures = await seedScopeIntegrationFixtures(uniqueId);
    app = createCatalogHttpApp();
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

  it("returns 401 for unauthenticated catalog list", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const response = await authRequest("http://localhost/api/v1/business-verticals", null);
    expect(response.status).toBe(401);
  });

  it("returns 403 when MANAGER lists business verticals", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      "http://localhost/api/v1/business-verticals",
      token
    );

    expect(response.status).toBe(403);
  });

  it("returns 403 when USER lists business verticals", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.fieldUser.email);
    const response = await authRequest(
      "http://localhost/api/v1/business-verticals",
      token
    );

    expect(response.status).toBe(403);
  });

  it("allows ADMIN to list business verticals", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.admin.email);
    const response = await authRequest(
      "http://localhost/api/v1/business-verticals",
      token
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns 403 when MANAGER creates a business vertical", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      "http://localhost/api/v1/business-verticals",
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: `VERTICAL_${fixtures.uniqueId}`,
          name: `Vertical ${fixtures.uniqueId}`,
        }),
      }
    );

    expect(response.status).toBe(403);
  });

  it("returns 401 for unauthenticated price index request", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const response = await authRequest("http://localhost/api/v1/price-index", null);
    expect(response.status).toBe(401);
  });

  it("allows MANAGER to read the price index and competitor product list", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.manager.email);

    const priceIndexResponse = await authRequest("http://localhost/api/v1/price-index", token);
    expect(priceIndexResponse.status).toBe(200);
    const priceIndexBody = (await priceIndexResponse.json()) as { data: unknown[] };
    expect(Array.isArray(priceIndexBody.data)).toBe(true);

    const competitorListResponse = await authRequest(
      "http://localhost/api/v1/competitor-products",
      token
    );
    expect(competitorListResponse.status).toBe(200);
  });

  it("returns 403 when MANAGER creates a competitor product", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.manager.email);
    const response = await authRequest(
      "http://localhost/api/v1/competitor-products",
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: `Denied Competitor ${fixtures.uniqueId}`,
          manufacturer: "Acme",
          countryOfOrigin: "Brasil",
          price17: 10,
          price18: 11,
          price20: 12,
          brasindiceUpdatedAt: "2026-01-01",
        }),
      }
    );

    expect(response.status).toBe(403);
  });

  it("allows ADMIN to create and update a competitor product", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const token = await loginToken(fixtures.admin.email);
    let competitorProductId: string | undefined;

    try {
      const createResponse = await authRequest(
        "http://localhost/api/v1/competitor-products",
        token,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: `Competitor ${fixtures.uniqueId}`,
            manufacturer: "Acme",
            countryOfOrigin: "Brasil",
            price17: 10,
            price18: 11,
            price20: 12,
            brasindiceUpdatedAt: "2026-01-01",
          }),
        }
      );

      expect(createResponse.status).toBe(200);
      const created = (await createResponse.json()) as { id: string; name: string };
      competitorProductId = created.id;
      expect(created.name).toBe(`Competitor ${fixtures.uniqueId}`);

      const updateResponse = await authRequest(
        `http://localhost/api/v1/competitor-products/${competitorProductId}`,
        token,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ price20: 99 }),
        }
      );

      expect(updateResponse.status).toBe(200);
      const updated = (await updateResponse.json()) as { price20: number };
      expect(updated.price20).toBe(99);
    } finally {
      if (competitorProductId) {
        await db.delete(competitorProducts).where(eq(competitorProducts.id, competitorProductId));
      }
    }
  });

  it("supports the full product comparison flow: link, compare, unlink", async () => {
    if (!dbReady) throw new Error("Test DB not ready — cannot run integration tests");

    const adminToken = await loginToken(fixtures.admin.email);
    const managerToken = await loginToken(fixtures.manager.email);

    let verticalId: string | undefined;
    let productId: string | undefined;
    let competitorProductId: string | undefined;

    try {
      const verticalResponse = await authRequest("http://localhost/api/v1/business-verticals", adminToken, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: `COMPARISON_${fixtures.uniqueId}`,
          name: `Comparison Vertical ${fixtures.uniqueId}`,
        }),
      });
      expect(verticalResponse.status).toBe(200);
      verticalId = ((await verticalResponse.json()) as { id: string }).id;

      const productResponse = await authRequest("http://localhost/api/v1/products", adminToken, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: `PROD-${fixtures.uniqueId}`,
          name: `AtlasProduct ${fixtures.uniqueId}`,
          verticalIds: [verticalId],
          simproCode: "SIM-1",
          brasindiceCode: "BRA-1",
          tissCode: "TISS-1",
          manufacturer: "AtlasMed",
          countryOfOrigin: "Brasil",
          price: 100,
          price17: 100,
          price18: 101,
          price20: 102,
          brasindiceUpdatedAt: "2026-01-01",
        }),
      });
      expect(productResponse.status).toBe(200);
      productId = ((await productResponse.json()) as { id: string }).id;

      const competitorResponse = await authRequest(
        "http://localhost/api/v1/competitor-products",
        adminToken,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: `Comparison Competitor ${fixtures.uniqueId}`,
            manufacturer: "Acme",
            countryOfOrigin: "China",
            price17: 200,
            price18: 201,
            price20: 202,
            brasindiceUpdatedAt: "2026-01-01",
          }),
        }
      );
      expect(competitorResponse.status).toBe(200);
      competitorProductId = ((await competitorResponse.json()) as { id: string }).id;

      const deniedLinkResponse = await authRequest(
        `http://localhost/api/v1/products/${productId}/competitors`,
        managerToken,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ competitorProductId }),
        }
      );
      expect(deniedLinkResponse.status).toBe(403);

      const linkResponse = await authRequest(
        `http://localhost/api/v1/products/${productId}/competitors`,
        adminToken,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ competitorProductId }),
        }
      );
      expect(linkResponse.status).toBe(200);

      const comparisonResponse = await authRequest(
        `http://localhost/api/v1/products/${productId}/comparison`,
        managerToken
      );
      expect(comparisonResponse.status).toBe(200);
      const comparison = (await comparisonResponse.json()) as {
        productId: string;
        rows: Array<{ id: string; isOwn: boolean }>;
      };
      expect(comparison.productId).toBe(productId);
      expect(comparison.rows.some((row) => row.id === productId && row.isOwn)).toBe(true);
      expect(comparison.rows.some((row) => row.id === competitorProductId && !row.isOwn)).toBe(
        true
      );

      const unlinkedResponse = await authRequest(
        `http://localhost/api/v1/products/${productId}/competitors/unlinked`,
        adminToken
      );
      expect(unlinkedResponse.status).toBe(200);
      const unlinked = (await unlinkedResponse.json()) as { data: Array<{ id: string }> };
      expect(unlinked.data.some((row) => row.id === competitorProductId)).toBe(false);

      const unlinkResponse = await authRequest(
        `http://localhost/api/v1/products/${productId}/competitors/${competitorProductId}`,
        adminToken,
        { method: "DELETE" }
      );
      expect(unlinkResponse.status).toBe(200);

      const comparisonAfterUnlinkResponse = await authRequest(
        `http://localhost/api/v1/products/${productId}/comparison`,
        adminToken
      );
      const comparisonAfterUnlink = (await comparisonAfterUnlinkResponse.json()) as {
        rows: Array<{ id: string }>;
      };
      expect(comparisonAfterUnlink.rows.some((row) => row.id === competitorProductId)).toBe(
        false
      );
    } finally {
      if (competitorProductId) {
        await db.delete(competitorProducts).where(eq(competitorProducts.id, competitorProductId));
      }
      if (productId) {
        await db.delete(products).where(eq(products.id, productId));
      }
      if (verticalId) {
        await db.delete(businessVerticals).where(eq(businessVerticals.id, verticalId));
      }
    }
  });
});
