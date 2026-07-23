import { createHash } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import {
  documentFiles,
  fileAssets,
  processingEvents,
  submissionDocuments,
} from "@atlasmed/database";
import { environment } from "@atlasmed/config";
import { getDb } from "../infrastructure/db";

export type CadastroFileUploadedInput = {
  fileAssetId: string;
  bucket: string;
  objectKey: string;
};

function storageClient(): S3Client {
  return new S3Client({
    region: environment.STORAGE_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: environment.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: environment.STORAGE_SECRET_ACCESS_KEY!,
    },
    ...(environment.STORAGE_ENDPOINT
      ? { endpoint: environment.STORAGE_ENDPOINT, forcePathStyle: true }
      : {}),
  });
}

async function recordEvent(
  fileAssetId: string,
  step: string,
  status: "STARTED" | "SUCCEEDED" | "FAILED",
  error?: { code?: string; message?: string }
) {
  const db = getDb();
  await db.insert(processingEvents).values({
    fileAssetId,
    processingStep: step,
    status,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
  });
}

function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }
  return null;
}

function countPdfPages(bytes: Uint8Array): number | null {
  try {
    const text = Buffer.from(bytes).toString("latin1");
    const matches = text.match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : null;
  } catch {
    return null;
  }
}

async function downloadObject(bucket: string, key: string): Promise<Uint8Array> {
  const response = await storageClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!response.Body) throw new Error(`Object missing body: ${key}`);
  return new Uint8Array(await response.Body.transformToByteArray());
}

async function markDocumentReadyIfComplete(fileAssetId: string) {
  const db = getDb();
  const [link] = await db
    .select()
    .from(documentFiles)
    .where(eq(documentFiles.fileAssetId, fileAssetId))
    .limit(1);
  if (!link) return;

  const files = await db
    .select({
      status: fileAssets.status,
    })
    .from(documentFiles)
    .innerJoin(fileAssets, eq(documentFiles.fileAssetId, fileAssets.id))
    .where(eq(documentFiles.submissionDocumentId, link.submissionDocumentId));

  if (files.length > 0 && files.every((f) => f.status === "READY")) {
    await db
      .update(submissionDocuments)
      .set({ status: "READY", updatedAt: new Date() })
      .where(
        and(
          eq(submissionDocuments.id, link.submissionDocumentId),
          eq(submissionDocuments.status, "DRAFT")
        )
      );
    // Also promote PROCESSING/CHANGES_REQUESTED docs once all files ready.
    await db
      .update(submissionDocuments)
      .set({ status: "READY", updatedAt: new Date() })
      .where(
        and(
          eq(submissionDocuments.id, link.submissionDocumentId),
          eq(submissionDocuments.status, "PROCESSING")
        )
      );
    await db
      .update(submissionDocuments)
      .set({ status: "READY", updatedAt: new Date() })
      .where(
        and(
          eq(submissionDocuments.id, link.submissionDocumentId),
          eq(submissionDocuments.status, "CHANGES_REQUESTED")
        )
      );
  }
}

export async function processCadastroFileUploadedActivity(
  input: CadastroFileUploadedInput
): Promise<{ fileAssetId: string; status: "READY" | "FAILED" }> {
  const db = getDb();
  const step = "processCadastroFile";
  await recordEvent(input.fileAssetId, step, "STARTED");

  try {
    const [existing] = await db
      .select()
      .from(fileAssets)
      .where(eq(fileAssets.id, input.fileAssetId))
      .limit(1);
    if (!existing) throw new Error(`File asset not found: ${input.fileAssetId}`);
    // API may have already processed inline — don't fail or rework.
    if (existing.status === "READY") {
      await markDocumentReadyIfComplete(input.fileAssetId);
      await recordEvent(input.fileAssetId, step, "SUCCEEDED");
      return { fileAssetId: input.fileAssetId, status: "READY" };
    }

    await db
      .update(fileAssets)
      .set({ status: "PROCESSING", updatedAt: new Date() })
      .where(eq(fileAssets.id, input.fileAssetId));

    const asset = existing;

    const head = await storageClient().send(
      new HeadObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
      })
    );
    if (!head.ContentLength || head.ContentLength <= 0) {
      throw new Error("Object empty or missing");
    }
    if (head.ContentLength !== asset.sizeBytes) {
      // Allow small mismatch from encoding; fail only on large drift.
      const delta = Math.abs(head.ContentLength - asset.sizeBytes);
      if (delta > 1024) {
        throw new Error(
          `Size mismatch: declared ${asset.sizeBytes}, stored ${head.ContentLength}`
        );
      }
    }

    const bytes = await downloadObject(input.bucket, input.objectKey);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (asset.sha256 && asset.sha256 !== sha256) {
      throw new Error("Checksum mismatch");
    }

    const detected = detectMime(bytes);
    if (!detected) {
      throw new Error("Unsupported or unrecognized file type");
    }
    const declared = asset.declaredMimeType.toLowerCase();
    const declaredNorm = declared === "image/jpg" ? "image/jpeg" : declared;
    const bothImages =
      declaredNorm.startsWith("image/") && detected.startsWith("image/");
    if (detected !== declaredNorm && !bothImages) {
      throw new Error(`MIME mismatch: declared ${declared}, detected ${detected}`);
    }

    let pageCount: number | null = null;
    if (detected === "application/pdf") {
      pageCount = countPdfPages(bytes) ?? 1;
    } else {
      pageCount = 1;
    }

    // Lightweight preview: store a copy key for images (no re-encode dependency).
    let previewObjectKey: string | null = null;
    let thumbObjectKey: string | null = null;
    if (detected.startsWith("image/")) {
      previewObjectKey = input.objectKey.replace(/\/original$/, "/preview");
      thumbObjectKey = input.objectKey.replace(/\/original$/, "/thumb");
      const client = storageClient();
      await client.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: previewObjectKey,
          Body: bytes,
          ContentType: detected,
        })
      );
      await client.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: thumbObjectKey,
          Body: bytes,
          ContentType: detected,
        })
      );
    }

    await db
      .update(fileAssets)
      .set({
        status: "READY",
        sha256,
        detectedMimeType: detected,
        pageCount,
        previewObjectKey,
        thumbObjectKey,
        processedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(fileAssets.id, input.fileAssetId));

    await markDocumentReadyIfComplete(input.fileAssetId);
    await recordEvent(input.fileAssetId, step, "SUCCEEDED");
    return { fileAssetId: input.fileAssetId, status: "READY" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(fileAssets)
      .set({
        status: "FAILED",
        errorCode: "PROCESSING_FAILED",
        errorMessage: message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(fileAssets.id, input.fileAssetId));
    await recordEvent(input.fileAssetId, step, "FAILED", {
      code: "PROCESSING_FAILED",
      message,
    });
    return { fileAssetId: input.fileAssetId, status: "FAILED" };
  }
}
