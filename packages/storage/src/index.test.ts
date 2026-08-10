import { describe, expect, test } from "bun:test";
import { createStorageClient, type StorageConfigInput } from "./index";

/**
 * This factory is the code #199 had to fix twice, because the API and the
 * Temporal worker each had a copy. Now there is one, so the properties that
 * defect turned on are pinned here rather than in neither place.
 */

const valid: StorageConfigInput = {
  STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  STORAGE_PUBLIC_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  STORAGE_BUCKET: "atlasmed-test",
  STORAGE_REGION: "auto",
  STORAGE_ACCESS_KEY_ID: "key",
  STORAGE_SECRET_ACCESS_KEY: "secret",
};

/**
 * S3Client normalises some config into async providers and leaves other fields
 * as plain values, so each is unwrapped on its own terms rather than assumed.
 */
async function resolved(env: StorageConfigInput) {
  const config = createStorageClient(env).config as {
    region: string | (() => Promise<string>);
    forcePathStyle: boolean;
    endpoint?: () => Promise<{ hostname: string }>;
  };

  return {
    region:
      typeof config.region === "function" ? await config.region() : config.region,
    forcePathStyle: config.forcePathStyle,
    endpointHostname: config.endpoint
      ? (await config.endpoint()).hostname
      : undefined,
  };
}

/**
 * MinIO, which ignores the region entirely. The region cases need a non-R2
 * endpoint: `assertStorageConfig` *requires* `auto` whenever the endpoint is
 * R2, so against R2 there is nothing for the factory's own default to decide.
 */
const minio: StorageConfigInput = {
  ...valid,
  STORAGE_ENDPOINT: "http://atlasmed-minio:9000",
  STORAGE_PUBLIC_ENDPOINT: "https://storage.example.com",
};

describe("createStorageClient", () => {
  test("signs path-style, unconditionally", async () => {
    // The original bug made this conditional on a truthy endpoint. MinIO
    // requires path-style and R2 accepts it, so it is never conditional.
    expect((await resolved(valid)).forcePathStyle).toBe(true);
  });

  test("targets the configured endpoint", async () => {
    expect((await resolved(valid)).endpointHostname).toBe(
      "account.r2.cloudflarestorage.com"
    );
  });

  test("defaults the region to auto, not us-east-1", async () => {
    // us-east-1 is the AWS default; R2 rejects it and MinIO ignores the value,
    // so it is only ever wrong. Both copies of this factory used to default to
    // it.
    const { STORAGE_REGION: _dropped, ...withoutRegion } = minio;
    expect((await resolved(withoutRegion)).region).toBe("auto");
  });

  test("honours an explicit region", async () => {
    expect(
      (await resolved({ ...minio, STORAGE_REGION: "us-east-1" })).region
    ).toBe("us-east-1");
  });

  /**
   * Not this package's rule, but worth pinning where the client is built: an
   * R2 endpoint with any region other than "auto" is rejected outright rather
   * than quietly signed. Discovered by these tests — the factory's own `auto`
   * fallback is unreachable against R2 because config gets there first.
   */
  test("rejects a non-auto region against an R2 endpoint", () => {
    expect(() =>
      createStorageClient({ ...valid, STORAGE_REGION: "us-east-1" })
    ).toThrow(/must be "auto"/i);
  });

  /**
   * The failure that mattered. Without an endpoint the SDK falls back to real
   * Amazon S3 and signs requests with this cluster's credentials — a silent
   * wrong destination, not an error. It must throw instead.
   */
  test("refuses to build a client with no endpoint", () => {
    const { STORAGE_ENDPOINT: _dropped, ...withoutEndpoint } = valid;
    expect(() => createStorageClient(withoutEndpoint)).toThrow(
      /misconfigured/i
    );
  });

  test("refuses to build a client with no credentials", () => {
    const {
      STORAGE_ACCESS_KEY_ID: _id,
      STORAGE_SECRET_ACCESS_KEY: _secret,
      ...withoutCredentials
    } = valid;
    expect(() => createStorageClient(withoutCredentials)).toThrow(
      /misconfigured/i
    );
  });
});
