import {
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  type BucketLocationConstraint,
  type CreateBucketCommandInput,
} from "@aws-sdk/client-s3";

type BucketProvisioningCommand =
  | HeadBucketCommand
  | CreateBucketCommand
  | ListObjectsV2Command;

export interface BucketProvisioningClient {
  send(command: BucketProvisioningCommand): Promise<unknown>;
}

/**
 * Raised when provisioning must not be retried and must not be tolerated:
 * the credential is wrong, or a probe came back unreadable so we cannot tell
 * whether it is wrong. Always fatal at boot.
 */
export class StorageProvisioningError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "StorageProvisioningError";
  }
}

export type BucketProvisioningOutcome =
  | { status: "exists" }
  | { status: "created" }
  | { status: "skipped"; reason: string };

function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("name" in error)) {
    return undefined;
  }
  return typeof error.name === "string" ? error.name : undefined;
}

interface S3ServiceError {
  name?: string;
  $metadata?: { httpStatusCode?: number };
}

function errorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("$metadata" in error)) {
    return undefined;
  }
  return (error as S3ServiceError).$metadata?.httpStatusCode;
}

function isNotFoundError(error: unknown): boolean {
  return errorName(error) === "NotFound" || errorStatusCode(error) === 404;
}

/**
 * Errors that will still be errors after any amount of waiting: bad
 * credentials, missing permissions, an illegal bucket name. Retrying these
 * hides a misconfiguration, so they must stay fatal.
 */
const PERMANENT_ERROR_NAMES = new Set([
  "AccessDenied",
  "AuthorizationHeaderMalformed",
  "CredentialsProviderError",
  "Forbidden",
  "InvalidAccessKeyId",
  "InvalidBucketName",
  "SignatureDoesNotMatch",
]);

export function isPermanentStorageError(error: unknown): boolean {
  if (error instanceof StorageProvisioningError) return true;

  const name = errorName(error);
  if (name && PERMANENT_ERROR_NAMES.has(name)) return true;

  const status = errorStatusCode(error);
  // 404 is "bucket missing", which this module handles by creating it.
  return status === 400 || status === 401 || status === 403;
}

/** Credential is wrong, not merely narrow. Verified against real MinIO. */
const BAD_CREDENTIAL_NAMES = new Set([
  "InvalidAccessKeyId",
  "SignatureDoesNotMatch",
]);

/** Credential is valid but not allowed to introspect the bucket. */
const SCOPED_CREDENTIAL_NAMES = new Set(["AccessDenied"]);

/**
 * Decide what a `HeadBucket` 403 actually meant.
 *
 * `HeadBucket` is an HTTP HEAD, so S3 returns no body and the SDK has nothing
 * to build an error code from: a wrong access key, a wrong secret and a
 * correctly-scoped R2 token all arrive identically as `name: "Unknown"` with
 * status 403. Verified against MinIO with genuinely wrong credentials, and
 * against a real object-only user.
 *
 * `ListObjectsV2` is a GET, so its 403 carries `<Code>` and the SDK types it.
 * Asking a question that can be answered beats guessing from a status code
 * that carries no information.
 */
export async function diagnoseForbiddenBucket(
  client: BucketProvisioningClient,
  bucket: string
): Promise<
  | { kind: "scoped"; detail: string }
  | { kind: "bad-credential"; detail: string }
  | { kind: "inconclusive"; detail: string }
> {
  try {
    await client.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })
    );
    return {
      kind: "scoped",
      detail: "credential can list objects but not HeadBucket",
    };
  } catch (error) {
    const name = errorName(error);

    if (name && BAD_CREDENTIAL_NAMES.has(name)) {
      return { kind: "bad-credential", detail: name };
    }

    if (name && SCOPED_CREDENTIAL_NAMES.has(name)) {
      return { kind: "scoped", detail: name };
    }

    // No usable error code: a network failure, or a store that answered
    // without one. We asked and did not get an answer, so we do not guess.
    return {
      kind: "inconclusive",
      detail: name && name !== "Unknown" ? name : describeError(error),
    };
  }
}

function describeError(error: unknown): string {
  const status = errorStatusCode(error);
  const name = errorName(error) ?? "unknown error";
  return status ? `${name} (HTTP ${status})` : name;
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    errorName(error) === "BucketAlreadyOwnedByYou" ||
    errorName(error) === "BucketAlreadyExists" ||
    errorStatusCode(error) === 409
  );
}

export async function ensureBucketExists(
  client: BucketProvisioningClient,
  bucket: string,
  region?: string
): Promise<BucketProvisioningOutcome> {
  if (!bucket) {
    throw new Error("Bucket name must be a non-empty string");
  }
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return { status: "exists" };
  } catch (error) {
    if (errorStatusCode(error) === 403) {
      const diagnosis = await diagnoseForbiddenBucket(client, bucket);

      if (diagnosis.kind === "bad-credential") {
        throw new StorageProvisioningError(
          `Object storage rejected the configured credential (${diagnosis.detail}). ` +
            "Check STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY.",
          error
        );
      }

      if (diagnosis.kind === "inconclusive") {
        throw new StorageProvisioningError(
          `HeadBucket on "${bucket}" was denied and the ListObjectsV2 probe was ` +
            `inconclusive (${diagnosis.detail}), so it is not possible to tell a ` +
            "narrowly-scoped credential from a wrong one. Refusing to continue.",
          error
        );
      }

      return {
        status: "skipped",
        reason: `credential cannot introspect the bucket (${diagnosis.detail})`,
      };
    }

    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const input: CreateBucketCommandInput = { Bucket: bucket };
  // "us-east-1" is the S3 default and "auto" is R2's only accepted region;
  // neither is a valid LocationConstraint.
  if (region && region !== "us-east-1" && region !== "auto") {
    input.CreateBucketConfiguration = {
      LocationConstraint: region as BucketLocationConstraint,
    };
  }

  try {
    await client.send(new CreateBucketCommand(input));
    return { status: "created" };
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
    return { status: "exists" };
  }
}
