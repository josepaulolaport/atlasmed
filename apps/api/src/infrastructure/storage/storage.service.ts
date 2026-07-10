import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageClient } from "./storage.client";
import { environment } from "../../app/config/environment";

/**
 * Thin storage adapter.
 * All business logic (which bucket, path conventions, ACL) lives in the
 * callers — this service only wraps the S3 primitives.
 */
export class StorageService {
  private readonly bucket: string;

  constructor() {
    this.bucket = environment.STORAGE_BUCKET;
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string
  ): Promise<void> {
    await storageClient.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async download(key: string): Promise<Uint8Array> {
    const response = await storageClient.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );

    if (!response.Body) {
      throw new Error(`Storage object not found: ${key}`);
    }

    return response.Body.transformToByteArray();
  }

  async signedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(
      storageClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSeconds }
    );
  }

  async delete(key: string): Promise<void> {
    await storageClient.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }
}

export const storageService = new StorageService();
