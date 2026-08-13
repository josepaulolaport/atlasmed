import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { environment } from "@atlasmed/config";
import { createStorageClient } from "@atlasmed/storage";
import {
  archiveFileName,
  openCnesArchiveDownload,
  verifyArchive,
  type ArchiveVerification,
  type CnesReference,
  type RangeReadable,
} from "@atlasmed/cnes-ingestion";
import { logger } from "../logger";

/**
 * The archive's home between fetching it and reading it (ADR 0010).
 *
 * DATASUS serves the file over HTTPS with no range support, and S3 serves ranges
 * but cannot fetch it. Storing it here is what lets each half of the job use the
 * transport it is actually good at.
 */

/** `cnes/BASE_DE_DADOS_CNES_202607.ZIP` — one object per competence. */
export function archiveObjectKey(reference: CnesReference): string {
  return `cnes/${archiveFileName(reference)}`;
}

let client: S3Client | null = null;
function storage(): S3Client {
  client ??= createStorageClient(environment);
  return client;
}

function bucket(): string {
  const name = environment.STORAGE_BUCKET;
  if (!name) throw new Error("STORAGE_BUCKET is required to store the CNES archive");
  return name;
}

/** An {@link RangeReadable} over one stored object. */
export function objectRangeReadable(key: string): RangeReadable {
  return {
    async size() {
      const head = await storage().send(
        new HeadObjectCommand({ Bucket: bucket(), Key: key })
      );
      return head.ContentLength ?? 0;
    },
    async read(from, to) {
      const object = await storage().send(
        new GetObjectCommand({
          Bucket: bucket(),
          Key: key,
          Range: `bytes=${from}-${to}`,
        })
      );
      const body = object.Body as { transformToByteArray?: () => Promise<Uint8Array> };
      if (!body?.transformToByteArray) {
        throw new Error(`range read of ${key} returned no body`);
      }
      return body.transformToByteArray();
    },
  };
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await storage().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export interface EnsureArchiveResult {
  key: string;
  /** False when a valid object was already present and the fetch was skipped. */
  downloaded: boolean;
  verification: ArchiveVerification;
}

/**
 * Puts the competence's archive in the bucket, or confirms it is already there.
 *
 * Idempotent by design. A load that fails must not re-fetch 725 MB, and this is
 * what makes that the default rather than a special path — Temporal retries the
 * load alone and this returns immediately. It is also why the manual-upload
 * fallback needs no code: put a ZIP at the key by hand and this skips.
 *
 * An object that fails verification is **deleted**, not left in place. A
 * truncated archive that survives is worse than none, because the next run would
 * skip the fetch and load from it.
 */
export async function ensureArchive(input: {
  reference: CnesReference;
  /** Re-fetch even if a valid object is present. */
  force?: boolean;
  heartbeat?: (detail: unknown) => void;
}): Promise<EnsureArchiveResult> {
  const key = archiveObjectKey(input.reference);
  const beat = input.heartbeat ?? (() => {});

  if (!input.force && (await objectExists(key))) {
    try {
      const verification = await verifyArchive(objectRangeReadable(key));
      logger.info("cnes.archive.reused", {
        key,
        sizeBytes: verification.sizeBytes,
        entries: verification.entryCount,
      });
      return { key, downloaded: false, verification };
    } catch (error) {
      // Present but unusable. Say so and replace it, rather than failing every
      // future run against the same bad object.
      logger.warn("cnes.archive.invalid_object_replaced", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      await storage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    }
  }

  const download = await openCnesArchiveDownload({ reference: input.reference });
  logger.info("cnes.archive.download_started", {
    key,
    // Usually absent: the endpoint is chunked. That is why verification below is
    // structural rather than a size comparison.
    declaredLength: download.declaredLength ?? undefined,
  });

  let uploaded = 0;
  // Counting bytes as they pass, purely so the activity can heartbeat: the
  // response is chunked and declares no length, so there is no percentage to
  // report and no total to check against afterwards.
  const counted = download.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        uploaded += chunk.length;
        beat({ key, uploadedBytes: uploaded });
        controller.enqueue(chunk);
      },
    })
  );

  const upload = new Upload({
    client: storage(),
    params: {
      Bucket: bucket(),
      Key: key,
      Body: counted as unknown as ReadableStream,
      ContentType: "application/zip",
    },
    // 8 MB parts: 725 MB is ~91 parts, comfortably under the 10 000 limit.
    partSize: 8 * 1024 * 1024,
    queueSize: 4,
  });
  upload.on("httpUploadProgress", () => beat({ key, uploadedBytes: uploaded }));
  await upload.done();

  let verification: ArchiveVerification;
  try {
    verification = await verifyArchive(objectRangeReadable(key));
  } catch (error) {
    // The check exists because this pipeline has been seen receiving short data
    // without an error. Keeping the object would mean every later run skips the
    // fetch and loads from something incomplete.
    await storage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    throw new Error(
      `archive at ${key} failed verification and was deleted: ` +
        (error instanceof Error ? error.message : String(error))
    );
  }

  logger.info("cnes.archive.stored", {
    key,
    sizeBytes: verification.sizeBytes,
    entries: verification.entryCount,
    uploadedBytes: uploaded,
  });
  return { key, downloaded: true, verification };
}
