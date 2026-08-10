import { S3Client } from "@aws-sdk/client-s3";
import { assertStorageConfig, type StorageConfigInput } from "@atlasmed/config";

export type { StorageConfigInput };

/**
 * The single place an S3 client is constructed.
 *
 * This existed twice before — `apps/api/src/infrastructure/storage/storage.client.ts`
 * and `apps/workers/temporal/src/activities/cadastro-file-processing.activities.ts`,
 * the latter carrying the comment "Mirrors apps/api/…/storage.client.ts". Both
 * copies had the same bug, and #199 had to fix it in both: a conditional spread
 * made `endpoint` and `forcePathStyle` depend on a truthy `STORAGE_ENDPOINT`, so
 * an unset endpoint produced virtual-host requests to real Amazon S3 signed with
 * this cluster's credentials — a silent wrong destination rather than an error.
 *
 * Fixing the same defect in two files is the argument for this package (spec
 * 0011 §2.1). Only the client factory moves here; the API's presigning and the
 * worker's processing pipeline stay where they are, because neither is shared.
 */
export function createStorageClient(env: StorageConfigInput): S3Client {
  // Throws on missing endpoint or credentials rather than signing something
  // aimed at the wrong host.
  assertStorageConfig(env);

  return new S3Client({
    // R2 accepts only "auto"; MinIO ignores the value entirely, so "auto" is
    // correct for both. Never inferred from an absent endpoint — that is what
    // used to send requests to real AWS with a us-east-1 default.
    region: env.STORAGE_REGION ?? "auto",
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
    },
    endpoint: env.STORAGE_ENDPOINT!,
    // Explicit, not conditional: MinIO requires path-style addressing and R2
    // accepts it, so both providers get signed identically.
    forcePathStyle: true,
  });
}
