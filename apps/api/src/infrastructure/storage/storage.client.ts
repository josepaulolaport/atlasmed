import { S3Client } from "@aws-sdk/client-s3";
import {
  STORAGE_REQUIRED_KEYS,
  assertStorageConfig,
  storageConfigIssues,
  type StorageConfigInput,
} from "@atlasmed/config";
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
export type StorageEnvironment = StorageConfigInput;

export function missingStorageConfig(
  env: StorageEnvironment = environment
): string[] {
  return STORAGE_REQUIRED_KEYS.filter((key) => !env[key]);
}

/**
 * Whether storage-backed features can run at all. Distinct from *valid*: a
 * configuration can be complete yet still rejected by `assertStorageConfig`
 * (http:// public endpoint, R2 with the wrong region).
 */
export function isStorageConfigured(
  env: StorageEnvironment = environment
): boolean {
  return missingStorageConfig(env).length === 0;
}

/**
 * Boot-time gate, so a bad configuration surfaces at startup rather than at
 * the first upload. Delegates to @atlasmed/config so the boot gate and the CI
 * `env:check` gate enforce exactly the same rules.
 */
export function assertStorageConfigured(
  env: StorageEnvironment = environment
): void {
  assertStorageConfig(env);
}

/** Re-exported so callers can list problems without throwing. */
export { storageConfigIssues };

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
