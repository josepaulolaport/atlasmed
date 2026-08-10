import { describe, expect, test } from "bun:test";
import { environmentIssues } from "./environment";

const PRODUCTION_ENV: Record<string, string> = {
  NODE_ENV: "production",
  UNCLOUD_CONNECT: "ssh://deploy@cluster.example.com",
  DATABASE_URL: "postgresql://user:pass@db:5432/atlasmed",
  REDIS_URL: "redis://redis:6379",
  JWT_ACCESS_SECRET: "a".repeat(48),
  TOKEN_HASH_PEPPER: "b".repeat(48),
  CORS_ORIGINS: "https://app.example.com",
  FRONTEND_URL: "https://app.example.com",
  RESEND_API_KEY: "re_live_key",
  RESEND_FROM_EMAIL: "no-reply@example.com",
  TEMPORAL_DB_PASSWORD: "c".repeat(24),
  MEILISEARCH_API_KEY: "d".repeat(24),
  MINIO_ROOT_USER: "atlasmed",
  MINIO_ROOT_PASSWORD: "e".repeat(24),
  STORAGE_ENDPOINT: "http://atlasmed-minio:9000",
  STORAGE_PUBLIC_ENDPOINT: "https://storage.example.com",
  STORAGE_BUCKET: "atlasmed-production",
  STORAGE_REGION: "us-east-1",
};

const productionEnv = (overrides: Record<string, string | undefined> = {}) => {
  const env: Record<string, string | undefined> = {
    ...PRODUCTION_ENV,
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return env;
};

describe("environmentIssues", () => {
  test("a complete production environment has no issues", () => {
    expect(environmentIssues(productionEnv())).toEqual([]);
  });

  test("development does not require storage configuration", () => {
    expect(
      environmentIssues({
        NODE_ENV: "development",
      }),
    ).toEqual([]);
  });

  describe("storage is production-required", () => {
    for (const key of [
      "STORAGE_BUCKET",
      "STORAGE_ENDPOINT",
      "STORAGE_PUBLIC_ENDPOINT",
    ]) {
      test(`${key} missing in production is rejected`, () => {
        const issues = environmentIssues(productionEnv({ [key]: undefined }));
        expect(issues).toContain(`/${key}: required in production`);
      });
    }

    test("all three missing are reported together, not just the first", () => {
      const issues = environmentIssues(
        productionEnv({
          STORAGE_BUCKET: undefined,
          STORAGE_ENDPOINT: undefined,
          STORAGE_PUBLIC_ENDPOINT: undefined,
        }),
      );
      expect(issues).toContain("/STORAGE_BUCKET: required in production");
      expect(issues).toContain("/STORAGE_ENDPOINT: required in production");
      expect(issues).toContain("/STORAGE_PUBLIC_ENDPOINT: required in production");
    });
  });

  test("a plain-HTTP public endpoint is rejected", () => {
    const issues = environmentIssues(
      productionEnv({ STORAGE_PUBLIC_ENDPOINT: "http://atlasmed-minio:9000" }),
    );
    expect(issues).toContain(
      "/STORAGE_PUBLIC_ENDPOINT: must be an https:// URL reachable by mobile clients",
    );
  });

  test("a non-URL internal endpoint is rejected", () => {
    const issues = environmentIssues(
      productionEnv({ STORAGE_ENDPOINT: "atlasmed-minio:9000" }),
    );
    expect(issues).toContain("/STORAGE_ENDPOINT: must be an absolute URL");
  });

  describe("Cloudflare R2", () => {
    const r2 = {
      STORAGE_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
      STORAGE_PUBLIC_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
    };

    test('rejects a region other than "auto"', () => {
      const issues = environmentIssues(
        productionEnv({ ...r2, STORAGE_REGION: "us-east-1" }),
      );
      expect(issues).toContain(
        '/STORAGE_REGION: must be "auto" when using Cloudflare R2',
      );
    });

    test('accepts region "auto"', () => {
      expect(
        environmentIssues(productionEnv({ ...r2, STORAGE_REGION: "auto" })),
      ).toEqual([]);
    });
  });
});
