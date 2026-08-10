import { describe, expect, test } from "bun:test";
import { provisionBucket } from "./bucket-provisioning";
import type { BucketProvisioningClient } from "./ensure-bucket-exists";

class FakeError extends Error {
  $metadata?: { httpStatusCode?: number };

  constructor(name: string, httpStatusCode?: number) {
    super(name);
    this.name = name;
    if (httpStatusCode !== undefined) {
      this.$metadata = { httpStatusCode };
    }
  }
}

/** Fails the first `failures` calls, then behaves like an existing bucket. */
function flakyClient(failures: number, error: () => Error) {
  let calls = 0;
  const client: BucketProvisioningClient = {
    async send() {
      calls += 1;
      if (calls <= failures) throw error();
      return {};
    },
  };
  return { client, calls: () => calls };
}

const noSleep = async () => {};

describe("provisionBucket", () => {
  test("succeeds on the first attempt when the bucket already exists", async () => {
    const { client, calls } = flakyClient(0, () => new FakeError("NotFound"));
    await provisionBucket(client, "atlasmed", "us-east-1", { sleep: noSleep });
    expect(calls()).toBe(1);
  });

  test("retries a connection failure and then succeeds", async () => {
    const { client, calls } = flakyClient(
      2,
      () => new FakeError("ECONNREFUSED"),
    );
    await provisionBucket(client, "atlasmed", "us-east-1", {
      attempts: 5,
      sleep: noSleep,
    });
    expect(calls()).toBe(3);
  });

  test("a storage backend that never comes up does not crash the caller", async () => {
    const { client, calls } = flakyClient(
      Number.MAX_SAFE_INTEGER,
      () => new FakeError("TimeoutError"),
    );
    await expect(
      provisionBucket(client, "atlasmed", "us-east-1", {
        attempts: 3,
        sleep: noSleep,
      }),
    ).resolves.toBeUndefined();
    expect(calls()).toBe(3);
  });

  test("a 503 from the store is treated as transient", async () => {
    const { client } = flakyClient(
      Number.MAX_SAFE_INTEGER,
      () => new FakeError("ServiceUnavailable", 503),
    );
    await expect(
      provisionBucket(client, "atlasmed", "us-east-1", {
        attempts: 2,
        sleep: noSleep,
      }),
    ).resolves.toBeUndefined();
  });

  describe("misconfiguration stays fatal", () => {
    for (const [name, status] of [
      ["InvalidAccessKeyId", 403],
      ["SignatureDoesNotMatch", 403],
      ["AccessDenied", 403],
      ["InvalidBucketName", 400],
    ] as const) {
      test(`${name} is rethrown without retrying`, async () => {
        const { client, calls } = flakyClient(
          Number.MAX_SAFE_INTEGER,
          () => new FakeError(name, status),
        );
        await expect(
          provisionBucket(client, "atlasmed", "us-east-1", {
            attempts: 5,
            sleep: noSleep,
          }),
        ).rejects.toThrow(name);
        expect(calls()).toBe(1);
      });
    }
  });
});
