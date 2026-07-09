import type { ArchiveStoragePort } from "./archive-storage.port";
import { LocalArchiveAdapter } from "./local-archive.adapter";
import { S3ArchiveAdapter } from "./s3-archive.adapter";

export type ArchiveBackend = "local" | "minio" | "s3";

export interface ArchiveAdapterConfig {
  backend?: ArchiveBackend;
  localPath?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export function createArchiveAdapter(input: ArchiveAdapterConfig = {}): ArchiveStoragePort {
  const backend =
    input.backend ??
    (process.env.CNES_ARCHIVE_BACKEND as ArchiveBackend | undefined) ??
    "local";

  if (backend === "local") {
    return new LocalArchiveAdapter(
      input.localPath ?? process.env.CNES_ARCHIVE_LOCAL_PATH ?? "/tmp/atlasmed-cnes-archive"
    );
  }

  const isMinio = backend === "minio";
  return new S3ArchiveAdapter({
    bucket:
      input.bucket ??
      process.env.CNES_ARCHIVE_S3_BUCKET ??
      (isMinio ? "cnes-raw" : "atlasmed-cnes-archive"),
    region: input.region ?? process.env.CNES_ARCHIVE_S3_REGION ?? "us-east-1",
    endpoint:
      input.endpoint ??
      process.env.CNES_ARCHIVE_S3_ENDPOINT ??
      (isMinio ? "http://localhost:9000" : undefined),
    accessKeyId:
      input.accessKeyId ??
      process.env.CNES_ARCHIVE_S3_ACCESS_KEY_ID ??
      (isMinio ? "minioadmin" : undefined),
    secretAccessKey:
      input.secretAccessKey ??
      process.env.CNES_ARCHIVE_S3_SECRET_ACCESS_KEY ??
      (isMinio ? "minioadmin" : undefined),
    forcePathStyle: isMinio || Boolean(process.env.CNES_ARCHIVE_S3_ENDPOINT),
  });
}
