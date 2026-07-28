import { S3Client } from "@aws-sdk/client-s3";
import { environment } from "../../app/config/environment";

let client: S3Client | null = null;
let presignClient: S3Client | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(
    environment.STORAGE_ACCESS_KEY_ID &&
      environment.STORAGE_SECRET_ACCESS_KEY &&
      environment.STORAGE_BUCKET
  );
}

function createS3Client(endpoint: string | undefined): S3Client {
  return new S3Client({
    region: environment.STORAGE_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: environment.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: environment.STORAGE_SECRET_ACCESS_KEY!,
    },
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: true,
        }
      : {}),
  });
}

/** Server-side ops (API ↔ MinIO). Prefer the internal cluster endpoint. */
export function getStorageClient(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error("Object storage is not configured");
  }

  if (!client) {
    client = createS3Client(environment.STORAGE_ENDPOINT);
  }

  return client;
}

/**
 * Client used only for presigned URLs handed to browsers/mobile.
 * Must use a hostname the device can reach (STORAGE_PUBLIC_ENDPOINT).
 */
export function getPresignStorageClient(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error("Object storage is not configured");
  }

  if (!presignClient) {
    const endpoint =
      environment.STORAGE_PUBLIC_ENDPOINT ?? environment.STORAGE_ENDPOINT;
    presignClient = createS3Client(endpoint);
  }

  return presignClient;
}
