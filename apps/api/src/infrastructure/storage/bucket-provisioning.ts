import { ensureBucketExists } from '@atlasmed/cnes-ingestion'
import { environment } from '../../app/config/environment'
import { getStorageClient, isStorageConfigured } from './storage.client'

export async function ensureStorageBuckets(): Promise<void> {
  if (!isStorageConfigured()) {
    return
  }

  await ensureBucketExists(
    getStorageClient(),
    // biome-ignore lint/style/noNonNullAssertion: guarded by isStorageConfigured()
    environment.STORAGE_BUCKET!,
    environment.STORAGE_REGION
  )
}
