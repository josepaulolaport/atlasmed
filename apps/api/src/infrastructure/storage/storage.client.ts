import { S3Client } from "@aws-sdk/client-s3";
import { environment } from "../../app/config/environment";

/**
 * S3-compatible client.
 * In development: points to local MinIO (STORAGE_ENDPOINT is set).
 * In production: uses AWS S3 / Cloudflare R2 (STORAGE_ENDPOINT is empty → AWS default).
 */
export const storageClient = new S3Client({
  region: environment.STORAGE_REGION,
  ...(environment.STORAGE_ENDPOINT
    ? {
        endpoint: environment.STORAGE_ENDPOINT,
        forcePathStyle: true,
      }
    : {}),
  credentials: {
    accessKeyId: environment.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: environment.STORAGE_SECRET_ACCESS_KEY,
  },
});
