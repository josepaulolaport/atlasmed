import {
  CreateBucketCommand,
  HeadBucketCommand,
  type BucketLocationConstraint,
  type CreateBucketCommandInput,
} from "@aws-sdk/client-s3";

type BucketProvisioningCommand = HeadBucketCommand | CreateBucketCommand;

export interface BucketProvisioningClient {
  send(command: BucketProvisioningCommand): Promise<unknown>;
}

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
  const name = errorName(error);
  if (name && PERMANENT_ERROR_NAMES.has(name)) return true;

  const status = errorStatusCode(error);
  // 404 is "bucket missing", which this module handles by creating it.
  return status === 400 || status === 401 || status === 403;
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
): Promise<void> {
  if (!bucket) {
    throw new Error("Bucket name must be a non-empty string");
  }
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch (error) {
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
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }
}
