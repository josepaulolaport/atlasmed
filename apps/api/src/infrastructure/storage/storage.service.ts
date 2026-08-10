import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { environment } from "../../app/config/environment";
import {
  clampPresignTtl,
  getPresignStorageClient,
  getStorageClient,
  isStorageConfigured,
} from "./storage.client";

export class StorageService {
  isConfigured(): boolean {
    return isStorageConfigured();
  }

  bucket(): string {
    if (!environment.STORAGE_BUCKET) {
      throw new Error("STORAGE_BUCKET is not configured");
    }
    return environment.STORAGE_BUCKET;
  }

  async upload(
    key: string,
    body: PutObjectCommandInput["Body"],
    contentType?: string
  ): Promise<void> {
    await getStorageClient().send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        Body: body,
        ...(contentType ? { ContentType: contentType } : {}),
      })
    );
  }

  async download(key: string): Promise<Uint8Array> {
    const response = await getStorageClient().send(
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    return new Uint8Array(await response.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await getStorageClient().send(
      new DeleteObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      })
    );
  }

  /** @deprecated Prefer signedGetUrl — kept for AvatarStoragePort compatibility. */
  async signedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    return this.signedGetUrl(key, ttlSeconds);
  }

  async signedGetUrl(key: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(
      getPresignStorageClient(),
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      }),
      { expiresIn: clampPresignTtl(ttlSeconds) }
    );
  }

  async signedPutUrl(
    key: string,
    contentType: string,
    ttlSeconds = 3600
  ): Promise<string> {
    return getSignedUrl(
      getPresignStorageClient(),
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: clampPresignTtl(ttlSeconds) }
    );
  }

  async headObject(key: string): Promise<{
    exists: boolean;
    contentLength?: number;
    contentType?: string;
    eTag?: string;
  }> {
    try {
      const response = await getStorageClient().send(
        new HeadObjectCommand({
          Bucket: this.bucket(),
          Key: key,
        })
      );
      return {
        exists: true,
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        eTag: response.ETag,
      };
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "NotFound" || name === "NoSuchKey") {
        return { exists: false };
      }
      throw error;
    }
  }

  async createMultipartUpload(
    key: string,
    contentType: string
  ): Promise<{ uploadId: string }> {
    const response = await getStorageClient().send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket(),
        Key: key,
        ContentType: contentType,
      })
    );
    if (!response.UploadId) {
      throw new Error("Failed to create multipart upload");
    }
    return { uploadId: response.UploadId };
  }

  async signedUploadPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    ttlSeconds = 3600
  ): Promise<string> {
    return getSignedUrl(
      getPresignStorageClient(),
      new UploadPartCommand({
        Bucket: this.bucket(),
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: clampPresignTtl(ttlSeconds) }
    );
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>
  ): Promise<void> {
    await getStorageClient().send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket(),
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .slice()
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({
              ETag: part.etag,
              PartNumber: part.partNumber,
            })),
        },
      })
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await getStorageClient().send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket(),
        Key: key,
        UploadId: uploadId,
      })
    );
  }
}

export const storageService = new StorageService();
