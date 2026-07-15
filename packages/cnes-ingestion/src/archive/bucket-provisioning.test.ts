import { describe, expect, mock, test } from "bun:test";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { ensureBucketExists } from "./bucket-provisioning";

describe("ensureBucketExists", () => {
  test("does not create bucket when it already exists", async () => {
    const client = {
      send: mock((_command: unknown) => Promise.resolve({})),
    };

    await ensureBucketExists(client, "cnes-raw");

    const calls = client.send.mock.calls;
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
  });

  test("creates bucket when it is missing", async () => {
    const client = {
      send: mock((command: unknown) => {
        if (command instanceof HeadBucketCommand) {
          return Promise.reject({ $metadata: { httpStatusCode: 404 } });
        }
        return Promise.resolve({});
      }),
    };

    await ensureBucketExists(client, "cnes-raw");

    const calls = client.send.mock.calls;
    expect(client.send).toHaveBeenCalledTimes(2);
    expect(calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
    expect(calls[1]?.[0]).toBeInstanceOf(CreateBucketCommand);
  });

  test("sets location constraint when creating a bucket outside us-east-1", async () => {
    const client = {
      send: mock((command: unknown) => {
        if (command instanceof HeadBucketCommand) {
          return Promise.reject({ $metadata: { httpStatusCode: 404 } });
        }
        return Promise.resolve({});
      }),
    };

    await ensureBucketExists(client, "cnes-raw", "eu-west-1");

    const createCommand = client.send.mock.calls[1]?.[0];
    expect(createCommand).toBeInstanceOf(CreateBucketCommand);
    expect((createCommand as CreateBucketCommand).input).toMatchObject({
      Bucket: "cnes-raw",
      CreateBucketConfiguration: { LocationConstraint: "eu-west-1" },
    });
  });

  test("treats concurrent bucket creation as success", async () => {
    const client = {
      send: mock((command: unknown) => {
        if (command instanceof HeadBucketCommand) {
          return Promise.reject({ $metadata: { httpStatusCode: 404 } });
        }
        return Promise.reject({ name: "BucketAlreadyOwnedByYou" });
      }),
    };

    await expect(ensureBucketExists(client, "cnes-raw")).resolves.toBeUndefined();
  });
});
