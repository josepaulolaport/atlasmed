import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { environment } from "../../app/config/environment";
import { getStorageClient, isStorageConfigured } from "./storage.client";

export class StorageService {
  isConfigured(): boolean {
    return isStorageConfigured();
  }

  private bucket(): string {
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

  async signedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(
      getStorageClient(),
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      }),
      { expiresIn: ttlSeconds }
    );
  }
}

export const storageService = new StorageService();
