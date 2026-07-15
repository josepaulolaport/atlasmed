import { ensureBucketExists } from "@atlasmed/cnes-ingestion";
import { environment } from "../../app/config/environment";
import { getStorageClient, isStorageConfigured } from "./storage.client";

export async function ensureStorageBuckets(): Promise<void> {
  if (!isStorageConfigured() || !environment.STORAGE_BUCKET) {
    return;
  }

  await ensureBucketExists(getStorageClient(), environment.STORAGE_BUCKET);
}
