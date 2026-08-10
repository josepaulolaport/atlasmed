import { describe, expect, test } from "bun:test";
import { storageClient } from "./cadastro-file-processing.activities";

const MINIO = {
  NODE_ENV: "production",
  STORAGE_ENDPOINT: "http://atlasmed-minio:9000",
  STORAGE_PUBLIC_ENDPOINT: "https://storage.example.com",
  STORAGE_ACCESS_KEY_ID: "id",
  STORAGE_SECRET_ACCESS_KEY: "secret",
  STORAGE_BUCKET: "atlasmed-production",
  STORAGE_REGION: "us-east-1",
};

const R2 = {
  ...MINIO,
  STORAGE_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  STORAGE_REGION: "auto",
};

describe("worker storageClient", () => {
  test("refuses to build a client without an endpoint", () => {
    // The old spread made endpoint and forcePathStyle conditional, so this
    // shape produced virtual-host requests to real Amazon S3, signed with this
    // cluster's credentials, with no error anywhere.
    expect(() =>
      storageClient({ ...MINIO, STORAGE_ENDPOINT: undefined }),
    ).toThrow(/STORAGE_ENDPOINT/);
  });

  test("refuses to build a client without credentials", () => {
    expect(() =>
      storageClient({
        ...MINIO,
        STORAGE_ACCESS_KEY_ID: undefined,
        STORAGE_SECRET_ACCESS_KEY: undefined,
      }),
    ).toThrow(/STORAGE_ACCESS_KEY_ID/);
  });

  test("refuses an R2 endpoint with a non-auto region", () => {
    expect(() =>
      storageClient({ ...R2, STORAGE_REGION: "us-east-1" }),
    ).toThrow(/auto/);
  });

  test("always uses path-style addressing, for MinIO and R2 alike", async () => {
    for (const env of [MINIO, R2]) {
      const client = storageClient(env);
      expect(client.config.forcePathStyle).toBe(true);
      const endpoint = await client.config.endpoint!();
      expect(endpoint.hostname).toBe(new URL(env.STORAGE_ENDPOINT!).hostname);
      // Never real AWS.
      expect(endpoint.hostname).not.toMatch(/amazonaws\.com$/);
    }
  });

  test("passes the configured region through unchanged", async () => {
    expect(await storageClient(R2).config.region()).toBe("auto");
    expect(await storageClient(MINIO).config.region()).toBe("us-east-1");
  });
});
