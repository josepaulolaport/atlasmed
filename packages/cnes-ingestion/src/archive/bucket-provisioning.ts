import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
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

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("name" in error && error.name === "NotFound") {
    return true;
  }

  if ("$metadata" in error) {
    const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
    return metadata?.httpStatusCode === 404;
  }

  return false;
}

export async function ensureBucketExists(
  client: BucketProvisioningClient,
  bucket: string
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  await client.send(new CreateBucketCommand({ Bucket: bucket }));
}

export async function ensureArchiveBucket(input: EnsureArchiveBucketInput): Promise<void> {
  if (!input.bucket) {
    return;
  }

  const config: S3ClientConfig = {
    region: input.region ?? "us-east-1",
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

  await ensureBucketExists(new S3Client(config), input.bucket);
}
