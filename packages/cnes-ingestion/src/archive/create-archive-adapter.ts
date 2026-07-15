import { environment } from "@atlasmed/config";
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
    environment.CNES_ARCHIVE_BACKEND;

  if (backend === "local") {
    return new LocalArchiveAdapter(
      input.localPath ?? environment.CNES_ARCHIVE_LOCAL_PATH
    );
  }

  const isMinio = backend === "minio";
  return new S3ArchiveAdapter({
    bucket:
      input.bucket ??
      environment.CNES_ARCHIVE_S3_BUCKET ??
      (isMinio ? "cnes-raw" : "atlasmed-cnes-archive"),
    region: input.region ?? environment.CNES_ARCHIVE_S3_REGION,
    endpoint:
      input.endpoint ??
      environment.CNES_ARCHIVE_S3_ENDPOINT ??
      (isMinio ? "http://localhost:9000" : undefined),
    accessKeyId:
      input.accessKeyId ??
      environment.CNES_ARCHIVE_S3_ACCESS_KEY_ID ??
      (isMinio ? "minioadmin" : undefined),
    secretAccessKey:
      input.secretAccessKey ??
      environment.CNES_ARCHIVE_S3_SECRET_ACCESS_KEY ??
      (isMinio ? "minioadmin" : undefined),
    forcePathStyle: isMinio || Boolean(environment.CNES_ARCHIVE_S3_ENDPOINT),
  });
}
