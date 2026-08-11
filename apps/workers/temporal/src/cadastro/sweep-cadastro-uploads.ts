import {
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { and, asc, eq, lt, notInArray } from "drizzle-orm";
import {
  documentFiles,
  fileAssets,
  submissionDocuments,
  uploadSessions,
} from "@atlasmed/database";
import { environment } from "@atlasmed/config";
import { createStorageClient } from "@atlasmed/storage";
import { getDb } from "../infrastructure/db";
import { logger } from "../logger";

/**
 * How long an upload may legitimately stay in flight before the sweep may touch
 * it.
 *
 * Matches the multipart session TTL in the API's cadastro use cases, which is
 * the longest window any legitimate upload has: a simple presigned PUT lives an
 * hour, a multipart session six. Using the longest one everywhere costs some
 * latency on cleanup and removes the possibility of deleting a file a rep is
 * still uploading.
 */
export const SWEEP_GRACE_MS = 6 * 60 * 60 * 1000;

/**
 * One run's ceiling. Each stale asset costs a HEAD against the object store, so
 * an unbounded run would turn a backlog into a long, retried activity. Whatever
 * is left is picked up by the next tick, ten minutes later.
 */
export const SWEEP_BATCH_SIZE = 200;

/** Terminal file-asset statuses. Everything else is an attempt that stopped. */
const TERMINAL_FILE_STATUSES = ["READY", "FAILED"] as const;
/** Terminal upload-session statuses. */
const TERMINAL_SESSION_STATUSES = ["COMPLETED", "ABORTED"] as const;

export type StaleUploadVerdict = "recover" | "fail" | "delete";

/**
 * What to do with one stale upload, given what the store says about it.
 *
 * Split out from the sweep because it is the only branching in it: everything
 * around it is a query or a write. Kept pure so the three cases can be proved
 * without a database or a bucket.
 *
 * The `absent` case is deliberately *not* what the API does with the same fact.
 * On `/uploads/complete` a missing object means FAILED, because a rep is waiting
 * and the row has to survive to carry the error and offer a retry. Here, hours
 * later, nobody is waiting and the row is only a ghost that blocks submit with
 * "Aguarde o processamento…". Same question to the store, different verdict,
 * because the context differs.
 */
export function classifyStaleUpload(
  asset: { sizeBytes: number },
  head: { exists: boolean; contentLength?: number }
): StaleUploadVerdict {
  if (!head.exists) return "delete";
  // An unknown length is not evidence of a mismatch. Treat "the store did not
  // say" as agreement rather than deleting a file that is probably fine.
  if (
    typeof head.contentLength === "number" &&
    head.contentLength !== asset.sizeBytes
  ) {
    return "fail";
  }
  return "recover";
}

export interface CadastroSweepReport {
  scanned: number;
  recovered: number;
  failed: number;
  deleted: number;
  sessionsAborted: number;
}

export interface SweepCadastroUploadsInput {
  now?: Date;
  limit?: number;
  storage?: S3Client;
  bucket?: string;
}

async function headObject(
  storage: S3Client,
  bucket: string,
  key: string
): Promise<{ exists: boolean; contentLength?: number }> {
  try {
    const response = await storage.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    return { exists: true, contentLength: response.ContentLength };
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === "NotFound" || name === "NoSuchKey") return { exists: false };
    throw error;
  }
}

/**
 * Promotes a document to READY once every file under it is READY.
 *
 * Without this a recovered file leaves its document sitting in DRAFT, so the
 * rep still cannot submit — the upload would be rescued and the symptom would
 * remain. Mirrors the same promotion the API performs on `/uploads/complete`;
 * they are two callers of one rule about documents, not about storage.
 */
async function promoteDocumentIfAllFilesReady(
  db: ReturnType<typeof getDb>,
  fileAssetId: number
): Promise<void> {
  const [link] = await db
    .select({ documentId: documentFiles.submissionDocumentId })
    .from(documentFiles)
    .where(eq(documentFiles.fileAssetId, fileAssetId))
    .limit(1);
  if (!link) return;

  const files = await db
    .select({ status: fileAssets.status })
    .from(documentFiles)
    .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
    .where(eq(documentFiles.submissionDocumentId, link.documentId));

  if (files.length === 0 || !files.every((f) => f.status === "READY")) return;

  await db
    .update(submissionDocuments)
    .set({ status: "READY" })
    .where(
      and(
        eq(submissionDocuments.id, link.documentId),
        // Only an open attempt is promoted. A document already submitted or
        // reviewed must not be dragged backwards by a late sweep.
        notInArray(submissionDocuments.status, [
          "SUBMITTED",
          "UNDER_REVIEW",
          "APPROVED",
          "REJECTED",
          "SUPERSEDED",
        ])
      )
    );
}

/**
 * Reconciles cadastro uploads against the object store, and aborts multipart
 * sessions nobody finished (ADR 0008 §2).
 *
 * **This reconciles; it does not merely delete.** Spec 0011 §1 names the case
 * that matters: the client PUTs the bytes and dies before calling
 * `/uploads/complete`, so an object sits in storage that the database never
 * learned about. Deleting those would throw away a file the rep already
 * uploaded successfully and make them do it again. The store is asked, and its
 * answer decides:
 *
 * | store says                   | verdict                                   |
 * |------------------------------|-------------------------------------------|
 * | object present, size matches | READY — the upload did happen             |
 * | object present, wrong size   | FAILED — truncated or swapped, with why   |
 * | object absent                | delete the link and the row               |
 *
 * Note the absent case differs from the API's verification of the same fact: on
 * `/uploads/complete` a missing object means FAILED, because a rep is waiting
 * and the row must survive to carry the error and offer a retry. Here, six
 * hours later, nobody is waiting and the row is only a ghost that blocks submit
 * with "Aguarde o processamento…". Same question to the store, different
 * verdict, because the context differs — which is why this is not a copy of
 * that logic.
 */
export async function sweepCadastroUploads(
  input: SweepCadastroUploadsInput = {}
): Promise<CadastroSweepReport> {
  const db = getDb();
  const now = input.now ?? new Date();
  const limit = input.limit ?? SWEEP_BATCH_SIZE;
  const storage = input.storage ?? createStorageClient(environment);
  const bucket = input.bucket ?? environment.STORAGE_BUCKET!;

  const report: CadastroSweepReport = {
    scanned: 0,
    recovered: 0,
    failed: 0,
    deleted: 0,
    sessionsAborted: 0,
  };

  const stale = await db
    .select()
    .from(fileAssets)
    // notInArray over the terminal pair, not inArray over the incomplete ones:
    // a status added to the enum later is then swept by default rather than
    // silently ignored, which is exactly how D-14 reached production — the
    // previous fix listed PENDING_UPLOAD and UPLOADING and stopped one short.
    .where(
      and(
        notInArray(fileAssets.status, [...TERMINAL_FILE_STATUSES]),
        lt(fileAssets.createdAt, new Date(now.getTime() - SWEEP_GRACE_MS))
      )
    )
    .orderBy(asc(fileAssets.createdAt))
    .limit(limit);

  for (const asset of stale) {
    report.scanned += 1;
    const head = await headObject(storage, asset.bucket || bucket, asset.objectKey);
    const verdict = classifyStaleUpload(asset, head);

    if (verdict === "delete") {
      // Delete the link first, then the row: `document_files.file_asset_id` is
      // ON DELETE restrict. Assets orphaned with no link at all (D-15) are
      // covered too — the first delete simply matches nothing.
      await db.delete(documentFiles).where(eq(documentFiles.fileAssetId, asset.id));
      await db.delete(fileAssets).where(eq(fileAssets.id, asset.id));
      report.deleted += 1;
      continue;
    }

    if (verdict === "fail") {
      await db
        .update(fileAssets)
        .set({
          status: "FAILED",
          errorCode: "VERIFICATION_FAILED",
          errorMessage: `Tamanho divergente: ${asset.sizeBytes} bytes declarados, ${head.contentLength} armazenados`,
          processedAt: now,
        })
        .where(eq(fileAssets.id, asset.id));
      report.failed += 1;
      continue;
    }

    // The bytes are there and they are the right bytes. The client simply never
    // got to say so.
    await db
      .update(fileAssets)
      .set({
        status: "READY",
        uploadedAt: asset.uploadedAt ?? now,
        processedAt: now,
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(fileAssets.id, asset.id));
    await promoteDocumentIfAllFilesReady(db, asset.id);
    report.recovered += 1;
  }

  report.sessionsAborted = await abortExpiredSessions({
    db,
    storage,
    bucket,
    now,
    limit,
  });

  logger.info("cadastro.sweep.completed", { ...report });
  return report;
}

/**
 * Aborts multipart uploads whose session expired unfinished.
 *
 * Without this the parts already uploaded stay in the bucket indefinitely and
 * are billed, invisible to the application and to any object-lifecycle rule —
 * lifecycle policies cannot see submission state (spec 0011 §6).
 */
async function abortExpiredSessions(input: {
  db: ReturnType<typeof getDb>;
  storage: S3Client;
  bucket: string;
  now: Date;
  limit: number;
}): Promise<number> {
  const sessions = await input.db
    .select({
      id: uploadSessions.id,
      storageUploadId: uploadSessions.storageUploadId,
      objectKey: fileAssets.objectKey,
      assetBucket: fileAssets.bucket,
    })
    .from(uploadSessions)
    .innerJoin(fileAssets, eq(uploadSessions.fileAssetId, fileAssets.id))
    .where(
      and(
        notInArray(uploadSessions.status, [...TERMINAL_SESSION_STATUSES]),
        lt(uploadSessions.expiresAt, input.now)
      )
    )
    .orderBy(asc(uploadSessions.expiresAt))
    .limit(input.limit);

  let aborted = 0;
  for (const session of sessions) {
    try {
      await input.storage.send(
        new AbortMultipartUploadCommand({
          Bucket: session.assetBucket || input.bucket,
          Key: session.objectKey,
          UploadId: session.storageUploadId,
        })
      );
    } catch (error) {
      // A session the store has already forgotten is still ours to close in the
      // database. Record what was suppressed rather than letting one dead
      // upload id stall the sweep — a swallowed error here would look exactly
      // like a clean run.
      logger.warn("cadastro.sweep.abort_multipart_failed", {
        uploadSessionId: session.id,
        storageUploadId: session.storageUploadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await input.db
      .update(uploadSessions)
      .set({ status: "ABORTED" })
      .where(eq(uploadSessions.id, session.id));
    aborted += 1;
  }

  return aborted;
}
