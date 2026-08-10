import { describe, expect, spyOn, test } from "bun:test";
import { HeadBucketCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { logger } from "../logging/logger";
import { provisionBucket } from "./bucket-provisioning";
import {
  ensureBucketExists,
  type BucketProvisioningClient,
} from "./ensure-bucket-exists";

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

/**
 * A store that denies HeadBucket with a bare 403 — the only thing S3 can
 * return for a HEAD, and identical for a scoped token and a wrong key — and
 * answers the ListObjectsV2 probe with `listResult`.
 */
function forbiddenHeadClient(listResult: () => unknown) {
  const seen: string[] = [];
  const client: BucketProvisioningClient = {
    async send(command) {
      if (command instanceof HeadBucketCommand) {
        seen.push("HeadBucket");
        throw new FakeError("Unknown", 403);
      }
      if (command instanceof ListObjectsV2Command) {
        seen.push("ListObjectsV2");
        const result = listResult();
        if (result instanceof Error) throw result;
        return result;
      }
      seen.push("CreateBucket");
      return {};
    },
  };
  return { client, seen };
}

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

  /**
   * HeadBucket 403 carries no error code, so the status alone cannot say
   * whether the credential is narrow or wrong. Every case below turns on what
   * the ListObjectsV2 probe answers.
   */
  describe("a denied HeadBucket is diagnosed, not guessed", () => {
    test("AccessDenied on the probe means scoped: boot continues", async () => {
      // Exactly what a real MinIO object-only user returns.
      const { client, seen } = forbiddenHeadClient(
        () => new FakeError("AccessDenied", 403),
      );

      await expect(
        provisionBucket(client, "atlasmed", "auto", { sleep: noSleep }),
      ).resolves.toBeUndefined();

      expect(seen).toEqual(["HeadBucket", "ListObjectsV2"]);
    });

    test("the skip warns, naming the bucket, so an operator can spot it", async () => {
      const { client } = forbiddenHeadClient(
        () => new FakeError("AccessDenied", 403),
      );
      const warn = spyOn(logger, "warn");

      try {
        await provisionBucket(client, "atlasmed-production", "auto", {
          sleep: noSleep,
        });
        expect(warn).toHaveBeenCalled();
        const [message, context] = warn.mock.calls.at(-1) as [
          string,
          Record<string, unknown>,
        ];
        expect(message).toMatch(/skipped/i);
        expect(context.bucket).toBe("atlasmed-production");
        expect(String(context.reason)).toContain("introspect");
      } finally {
        warn.mockRestore();
      }
    });

    test("a probe that succeeds also means scoped", async () => {
      const { client } = forbiddenHeadClient(() => ({ Contents: [] }));
      await expect(
        provisionBucket(client, "atlasmed", "auto", { sleep: noSleep }),
      ).resolves.toBeUndefined();
    });

    test("the skip is reported as an outcome, not silently", async () => {
      const { client } = forbiddenHeadClient(
        () => new FakeError("AccessDenied", 403),
      );
      const outcome = await ensureBucketExists(client, "atlasmed", "auto");
      expect(outcome.status).toBe("skipped");
      expect(outcome).toHaveProperty("reason");
    });

    test("InvalidAccessKeyId on the probe is fatal", async () => {
      const { client, seen } = forbiddenHeadClient(
        () => new FakeError("InvalidAccessKeyId", 403),
      );

      await expect(
        provisionBucket(client, "atlasmed", "auto", {
          attempts: 5,
          sleep: noSleep,
        }),
      ).rejects.toThrow(/rejected the configured credential/);

      // Diagnosed once; a wrong key is not worth retrying.
      expect(seen).toEqual(["HeadBucket", "ListObjectsV2"]);
    });

    test("SignatureDoesNotMatch on the probe is fatal", async () => {
      const { client } = forbiddenHeadClient(
        () => new FakeError("SignatureDoesNotMatch", 403),
      );
      await expect(
        provisionBucket(client, "atlasmed", "auto", { sleep: noSleep }),
      ).rejects.toThrow(/SignatureDoesNotMatch/);
    });

    test("an untyped probe failure is fatal, not assumed benign", async () => {
      const { client } = forbiddenHeadClient(() => new FakeError("Unknown", 403));
      await expect(
        provisionBucket(client, "atlasmed", "auto", {
          attempts: 5,
          sleep: noSleep,
        }),
      ).rejects.toThrow(/inconclusive/);
    });

    test("a network failure on the probe is fatal, not retried into a pass", async () => {
      // No status code at all: this used to look transient, which would have
      // exhausted the retries and then booted.
      const { client } = forbiddenHeadClient(() => new Error("ECONNRESET"));
      await expect(
        provisionBucket(client, "atlasmed", "auto", {
          attempts: 3,
          sleep: noSleep,
        }),
      ).rejects.toThrow(/inconclusive/);
    });

    test("the fatal message names the bucket and the probe", async () => {
      const { client } = forbiddenHeadClient(() => new Error("ECONNRESET"));
      let message = "";
      try {
        await provisionBucket(client, "atlasmed-production", "auto", {
          sleep: noSleep,
        });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("atlasmed-production");
      expect(message).toContain("ListObjectsV2");
    });
  });

  // 403 is deliberately absent here: it is the one status that cannot be
  // judged on its own, so it goes through the probe above instead.
  describe("misconfiguration stays fatal", () => {
    for (const [name, status] of [
      ["InvalidBucketName", 400],
      ["Unauthorized", 401],
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
