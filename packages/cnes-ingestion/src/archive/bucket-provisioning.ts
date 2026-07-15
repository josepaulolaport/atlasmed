import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  type BucketLocationConstraint,
  type CreateBucketCommandInput,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

export interface EnsureArchiveBucketInput {
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

interface BucketProvisioningClient {
  send: S3Client["send"];
}

function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("name" in error)) {
    return undefined;
  }

  return typeof error.name === "string" ? error.name : undefined;
}

function errorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("$metadata" in error)) {
    return undefined;
  }

  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

function isNotFoundError(error: unknown): boolean {
  return errorName(error) === "NotFound" || errorStatusCode(error) === 404;
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
// AWS S3: us-east-1 is the default region and does not require LocationConstraint.
// For S3-compatible services, this behavior may differ.
if (region && region !== "us-east-1") {
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

export async function ensureArchiveBucket(input: EnsureArchiveBucketInput): Promise<void> {
  if (!input.bucket) {
    return;
  }

  const region = input.region ?? "us-east-1";
  const config: S3ClientConfig = {
    region,
    endpoint: input.endpoint,
    forcePathStyle: input.forcePathStyle ?? Boolean(input.endpoint),
    credentials:
      input.accessKeyId && input.secretAccessKey
        ? {
            accessKeyId: input.accessKeyId,
            secretAccessKey: input.secretAccessKey,
          }
        : undefined,
  };

  await ensureBucketExists(new S3Client(config), input.bucket, region);
}
