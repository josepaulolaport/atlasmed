import { S3Client } from "@aws-sdk/client-s3";
import { environment } from "../../app/config/environment";

let client: S3Client | null = null;
let presignClient: S3Client | null = null;

/**
 * R2 refuses presigned URLs valid for longer than 7 days. MinIO is more
 * permissive, but capping everywhere keeps dev and prod behaving identically —
 * provider limits belong here, never in a use-case.
 */
export const MAX_PRESIGN_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Only the storage-relevant slice of the environment, so this stays testable. */
export interface StorageEnvironment {
  STORAGE_ENDPOINT?: string;
  STORAGE_PUBLIC_ENDPOINT?: string;
  STORAGE_ACCESS_KEY_ID?: string;
  STORAGE_SECRET_ACCESS_KEY?: string;
  STORAGE_BUCKET?: string;
  STORAGE_REGION?: string;
  NODE_ENV?: string;
}

const REQUIRED_STORAGE_KEYS = [
  "STORAGE_ENDPOINT",
  "STORAGE_PUBLIC_ENDPOINT",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "STORAGE_BUCKET",
] as const satisfies readonly (keyof StorageEnvironment)[];

export function missingStorageConfig(
  env: StorageEnvironment = environment
): string[] {
  return REQUIRED_STORAGE_KEYS.filter((key) => !env[key]);
}

export function isStorageConfigured(
  env: StorageEnvironment = environment
): boolean {
  return missingStorageConfig(env).length === 0;
}

/**
 * Boot-time gate. Throws when object storage is misconfigured, so the failure
 * surfaces at startup instead of at the first upload.
 *
 * A completely empty storage configuration is tolerated outside production:
 * local development without MinIO simply runs with storage-backed features
 * disabled. A *partial* configuration is always fatal — that is the shape a
 * typo or a dropped deploy variable takes, and it is exactly the case that used
 * to boot happily and then hand unreachable URLs to phones.
 */
export function assertStorageConfigured(
  env: StorageEnvironment = environment
): void {
  const missing = missingStorageConfig(env);
  if (missing.length === 0) return;

  const isProduction = env.NODE_ENV === "production";
  const isFullyUnset = missing.length === REQUIRED_STORAGE_KEYS.length;

  if (!isProduction && isFullyUnset) return;

  throw new Error(
    `Object storage is misconfigured; missing: ${missing.join(", ")}. ` +
      "All of these are required together — refusing to start with a partial " +
      "storage configuration."
  );
}

/**
 * Endpoint used to sign URLs handed to browsers/mobile. Deliberately has **no**
 * fallback to STORAGE_ENDPOINT: substituting the cluster-internal hostname
 * produces a presigned URL that no device can reach (and, over plain HTTP,
 * leaks internal topology). A boot failure is cheap and obvious; a silently
 * wrong signed URL fails per-request, in the field, for users only.
 */
export function resolvePresignEndpoint(
  env: StorageEnvironment = environment
): string {
  const endpoint = env.STORAGE_PUBLIC_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "STORAGE_PUBLIC_ENDPOINT is not configured. It must be set to a URL " +
        "reachable by clients; it is never derived from STORAGE_ENDPOINT."
    );
  }
  return endpoint;
}

export function resolveInternalEndpoint(
  env: StorageEnvironment = environment
): string {
  const endpoint = env.STORAGE_ENDPOINT;
  if (!endpoint) {
    throw new Error("STORAGE_ENDPOINT is not configured");
  }
  return endpoint;
}

/** Clamp a requested TTL into the range every supported provider accepts. */
export function clampPresignTtl(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error(`Invalid presign TTL: ${ttlSeconds}`);
  }
  return Math.min(Math.floor(ttlSeconds), MAX_PRESIGN_TTL_SECONDS);
}

function createS3Client(
  endpoint: string,
  env: StorageEnvironment = environment
): S3Client {
  return new S3Client({
    // R2 requires "auto"; MinIO ignores the value. Never inferred from an
    // absent endpoint, which used to make the SDK target real AWS S3.
    region: env.STORAGE_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
    },
    endpoint,
    // Explicit, not conditional: MinIO requires path-style addressing and R2
    // accepts it, so both providers are signed identically.
    forcePathStyle: true,
  });
}

/** Server-side ops (API ↔ object store). Uses the internal cluster endpoint. */
export function getStorageClient(): S3Client {
  assertStorageConfigured();

  if (!client) {
    client = createS3Client(resolveInternalEndpoint());
  }

  return client;
}

/**
 * Client used only for presigned URLs handed to browsers/mobile.
 * Must use a hostname the device can reach (STORAGE_PUBLIC_ENDPOINT).
 */
export function getPresignStorageClient(): S3Client {
  assertStorageConfigured();

  if (!presignClient) {
    presignClient = createS3Client(resolvePresignEndpoint());
  }

  return presignClient;
}

/** Test seam — drops the memoized clients. */
export function resetStorageClients(): void {
  client = null;
  presignClient = null;
}
