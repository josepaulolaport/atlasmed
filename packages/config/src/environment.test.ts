import { describe, expect, test } from "bun:test";
import {
  assertStorageConfig,
  environmentIssues,
  storageConfigIssues,
} from "./environment";

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
  STORAGE_ACCESS_KEY_ID: "storage-key-id",
  STORAGE_SECRET_ACCESS_KEY: "storage-secret",
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

const productionEnvWithout = (key: string) => productionEnv({ [key]: undefined });

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
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
    ]) {
      test(`${key} missing in production is rejected`, () => {
        expect(environmentIssues(productionEnvWithout(key))).toContain(
          `/${key}: required in production`,
        );
      });
    }

    test("all five missing are reported together, not just the first", () => {
      const issues = environmentIssues(
        productionEnv({
          STORAGE_BUCKET: undefined,
          STORAGE_ENDPOINT: undefined,
          STORAGE_PUBLIC_ENDPOINT: undefined,
          STORAGE_ACCESS_KEY_ID: undefined,
          STORAGE_SECRET_ACCESS_KEY: undefined,
        }),
      );
      expect(issues).toContain("/STORAGE_BUCKET: required in production");
      expect(issues).toContain("/STORAGE_ENDPOINT: required in production");
      expect(issues).toContain("/STORAGE_PUBLIC_ENDPOINT: required in production");
      expect(issues).toContain("/STORAGE_ACCESS_KEY_ID: required in production");
      expect(issues).toContain(
        "/STORAGE_SECRET_ACCESS_KEY: required in production",
      );
    });

    test("an empty string reads as unset, not as a schema violation", () => {
      // `- STORAGE_ENDPOINT=${STORAGE_ENDPOINT}` in compose, and a GitHub
      // Actions expression with no fallback, both yield "" when the variable
      // is missing. That is the real production failure shape.
      const issues = environmentIssues(
        productionEnv({
          STORAGE_ENDPOINT: "",
          STORAGE_ACCESS_KEY_ID: "",
        }),
      );
      expect(issues).toContain("/STORAGE_ENDPOINT: required in production");
      expect(issues).toContain("/STORAGE_ACCESS_KEY_ID: required in production");
      expect(issues.join("\n")).not.toContain("string length");
    });

    test("credential-less storage does not pass the production gate", () => {
      // Compose used to map MINIO_ROOT_* onto the credentials; once that
      // fallback is gone an unset secret is an empty credential.
      const issues = environmentIssues(
        productionEnv({
          STORAGE_ACCESS_KEY_ID: undefined,
          STORAGE_SECRET_ACCESS_KEY: undefined,
        }),
      );
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe("deployment-only variables are not demanded of a running service", () => {
    // UNCLOUD_CONNECT is the deploy CLI's ssh target, TEMPORAL_DB_PASSWORD
    // belongs to the Temporal Postgres service, and MINIO_ROOT_* provision the
    // MinIO server. None are injected into the API container, so a boot gate
    // built on environmentIssues would brick a correctly deployed API.
    for (const key of [
      "UNCLOUD_CONNECT",
      "TEMPORAL_DB_PASSWORD",
      "MINIO_ROOT_USER",
      "MINIO_ROOT_PASSWORD",
    ]) {
      test(`${key} is a deploy-time requirement only`, () => {
        expect(environmentIssues(productionEnvWithout(key))).toContain(
          `/${key}: required in production`,
        );
        // ...but never part of what a service validates at boot.
        expect(
          storageConfigIssues({ ...PRODUCTION_ENV, [key]: undefined }),
        ).toEqual([]);
      });
    }
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

describe("storageConfigIssues (the boot gate)", () => {
  const complete = {
    NODE_ENV: "production",
    STORAGE_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
    STORAGE_PUBLIC_ENDPOINT: "https://files.example.com",
    STORAGE_ACCESS_KEY_ID: "id",
    STORAGE_SECRET_ACCESS_KEY: "secret",
    STORAGE_BUCKET: "atlasmed-production",
    STORAGE_REGION: "auto",
  };

  test("accepts a complete R2 configuration", () => {
    expect(storageConfigIssues(complete)).toEqual([]);
  });

  test("enforces the R2 region rule at boot, not only in CI", () => {
    expect(
      storageConfigIssues({ ...complete, STORAGE_REGION: "us-east-1" }),
    ).toContain('/STORAGE_REGION: must be "auto" when using Cloudflare R2');
  });

  test("enforces the https public-endpoint rule at boot, not only in CI", () => {
    expect(
      storageConfigIssues({
        ...complete,
        STORAGE_PUBLIC_ENDPOINT: "http://atlasmed-minio:9000",
      }),
    ).toContain(
      "/STORAGE_PUBLIC_ENDPOINT: must be an https:// URL reachable by mobile clients",
    );
  });

  test("storage entirely unset is fine outside production", () => {
    expect(storageConfigIssues({ NODE_ENV: "development" })).toEqual([]);
  });

  test("a partial configuration is rejected even in development", () => {
    const issues = storageConfigIssues({
      NODE_ENV: "development",
      STORAGE_BUCKET: "atlasmed-dev",
    });
    expect(issues).toContain(
      "/STORAGE_ENDPOINT: required when object storage is configured",
    );
    expect(issues).toContain(
      "/STORAGE_ACCESS_KEY_ID: required when object storage is configured",
    );
  });

  test("plain-http public endpoints are allowed in development", () => {
    expect(
      storageConfigIssues({
        NODE_ENV: "development",
        STORAGE_ENDPOINT: "http://localhost:9000",
        STORAGE_PUBLIC_ENDPOINT: "http://localhost:9000",
        STORAGE_ACCESS_KEY_ID: "minioadmin",
        STORAGE_SECRET_ACCESS_KEY: "minioadmin",
        STORAGE_BUCKET: "atlasmed-dev",
        STORAGE_REGION: "us-east-1",
      }),
    ).toEqual([]);
  });

  test("assertStorageConfig throws listing every problem", () => {
    let message = "";
    try {
      assertStorageConfig({
        NODE_ENV: "production",
        STORAGE_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
        STORAGE_REGION: "us-east-1",
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("refusing to start");
    expect(message).toContain("/STORAGE_ACCESS_KEY_ID: required in production");
    expect(message).toContain('/STORAGE_REGION: must be "auto"');
  });
});
