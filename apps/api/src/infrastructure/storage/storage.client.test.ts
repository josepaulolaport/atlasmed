import { describe, expect, test } from "bun:test";
import {
  MAX_PRESIGN_TTL_SECONDS,
  assertStorageConfigured,
  clampPresignTtl,
  isStorageConfigured,
  missingStorageConfig,
  resolvePresignEndpoint,
  type StorageEnvironment,
} from "./storage.client";

const CONFIGURED: StorageEnvironment = {
  STORAGE_ENDPOINT: "http://atlasmed-minio:9000",
  STORAGE_PUBLIC_ENDPOINT: "https://storage.example.com",
  STORAGE_ACCESS_KEY_ID: "key",
  STORAGE_SECRET_ACCESS_KEY: "secret",
  STORAGE_BUCKET: "atlasmed",
  STORAGE_REGION: "us-east-1",
  NODE_ENV: "production",
};

describe("resolvePresignEndpoint", () => {
  test("uses the public endpoint", () => {
    expect(resolvePresignEndpoint(CONFIGURED)).toBe(
      "https://storage.example.com",
    );
  });

  test("does NOT fall back to the internal endpoint", () => {
    const env = { ...CONFIGURED, STORAGE_PUBLIC_ENDPOINT: undefined };
    expect(() => resolvePresignEndpoint(env)).toThrow(
      /STORAGE_PUBLIC_ENDPOINT is not configured/,
    );
  });

  test("the thrown message never leaks the internal endpoint", () => {
    const env = { ...CONFIGURED, STORAGE_PUBLIC_ENDPOINT: undefined };
    let message = "";
    try {
      resolvePresignEndpoint(env);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain("atlasmed-minio");
  });
});

describe("missingStorageConfig", () => {
  test("reports nothing when fully configured", () => {
    expect(missingStorageConfig(CONFIGURED)).toEqual([]);
    expect(isStorageConfigured(CONFIGURED)).toBe(true);
  });

  test("an endpoint-less configuration is not 'configured'", () => {
    // Previously this shape signed virtual-host URLs against real AWS S3.
    const env = { ...CONFIGURED, STORAGE_ENDPOINT: undefined };
    expect(missingStorageConfig(env)).toEqual(["STORAGE_ENDPOINT"]);
    expect(isStorageConfigured(env)).toBe(false);
  });
});

describe("assertStorageConfigured", () => {
  test("passes when fully configured", () => {
    expect(() => assertStorageConfigured(CONFIGURED)).not.toThrow();
  });

  test("throws in production when storage is entirely unset", () => {
    expect(() => assertStorageConfigured({ NODE_ENV: "production" })).toThrow(
      /misconfigured/,
    );
  });

  test("tolerates entirely-unset storage outside production", () => {
    expect(() =>
      assertStorageConfigured({ NODE_ENV: "development" }),
    ).not.toThrow();
  });

  test("a partial configuration is fatal even in development", () => {
    expect(() =>
      assertStorageConfigured({
        NODE_ENV: "development",
        STORAGE_BUCKET: "atlasmed",
      }),
    ).toThrow(/STORAGE_ENDPOINT/);
  });
});

describe("clampPresignTtl", () => {
  test("leaves ordinary TTLs alone", () => {
    expect(clampPresignTtl(3600)).toBe(3600);
  });

  test("caps at the R2 ceiling of 7 days", () => {
    expect(clampPresignTtl(30 * 24 * 3600)).toBe(MAX_PRESIGN_TTL_SECONDS);
    expect(MAX_PRESIGN_TTL_SECONDS).toBe(604800);
  });

  test("rejects non-positive TTLs", () => {
    expect(() => clampPresignTtl(0)).toThrow();
    expect(() => clampPresignTtl(-1)).toThrow();
  });
});
