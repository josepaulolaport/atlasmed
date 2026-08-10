import { environment } from "../../app/config/environment";
import { logger } from "../logging/logger";
import {
  ensureBucketExists,
  isPermanentStorageError,
  type BucketProvisioningClient,
} from "./ensure-bucket-exists";
import { getStorageClient, isStorageConfigured } from "./storage.client";

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 500;

export interface BucketProvisioningOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface EnsureStorageBucketsOptions extends BucketProvisioningOptions {
  client?: BucketProvisioningClient;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Provision the configured bucket, tolerating a storage backend that is not
 * accepting connections yet.
 *
 * The distinction that matters:
 *  - a *permanent* error (wrong credential, illegal bucket name, or a probe
 *    that could not answer whether the credential is wrong) is rethrown, so
 *    the API refuses to start;
 *  - a credential that is valid but cannot introspect the bucket is normal on
 *    R2 and only warns — see ensureBucketExists;
 *  - a *transient* error (connection refused, timeout, 5xx) is retried with
 *    backoff and, if it still fails, only logged. The API then starts and
 *    serves every non-storage route; uploads fail loudly per-request until the
 *    store returns. Crash-looping the whole API because MinIO booted a few
 *    seconds late trades a partial outage for a total one.
 */
export async function provisionBucket(
  client: BucketProvisioningClient,
  bucket: string,
  region: string | undefined,
  options: BucketProvisioningOptions = {}
): Promise<void> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const outcome = await ensureBucketExists(client, bucket, region);

      if (outcome.status === "skipped") {
        logger.warn(
          "Object storage bucket provisioning skipped; assuming the bucket exists",
          {
            bucket,
            reason: outcome.reason,
            hint: "expected for an R2 token scoped to object access; if uploads fail with NoSuchBucket, create the bucket manually",
          }
        );
      }

      return;
    } catch (error) {
      if (isPermanentStorageError(error)) {
        throw error;
      }

      if (attempt === attempts) {
        logger.error(
          "Object storage bucket provisioning failed; starting anyway",
          error,
          { bucket, attempts }
        );
        return;
      }

      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
}

export async function ensureStorageBuckets(
  options: EnsureStorageBucketsOptions = {}
): Promise<void> {
  if (!isStorageConfigured()) {
    return;
  }

  const { client, ...retryOptions } = options;

  await provisionBucket(
    client ?? getStorageClient(),
    environment.STORAGE_BUCKET!,
    environment.STORAGE_REGION,
    retryOptions
  );
}
