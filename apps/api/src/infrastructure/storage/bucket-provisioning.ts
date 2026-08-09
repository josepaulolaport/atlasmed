import { environment } from "../../app/config/environment";
import { ensureBucketExists } from "./ensure-bucket-exists";
import { getStorageClient, isStorageConfigured } from "./storage.client";

export async function ensureStorageBuckets(): Promise<void> {
  if (!isStorageConfigured()) {
    return;
  }

  await ensureBucketExists(
    getStorageClient(),
    environment.STORAGE_BUCKET!,
    environment.STORAGE_REGION
  );
}
