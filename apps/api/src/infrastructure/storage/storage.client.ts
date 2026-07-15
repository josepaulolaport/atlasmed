import { S3Client } from '@aws-sdk/client-s3'
import { environment } from '../../app/config/environment'

let client: S3Client | null = null

export function isStorageConfigured(): boolean {
  return Boolean(
    environment.STORAGE_ACCESS_KEY_ID &&
      environment.STORAGE_SECRET_ACCESS_KEY &&
      environment.STORAGE_BUCKET
  )
}

export function getStorageClient(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error('Object storage is not configured')
  }

  if (!client) {
    client = new S3Client({
      region: environment.STORAGE_REGION ?? 'us-east-1',
      credentials: {
        // biome-ignore lint/style/noNonNullAssertion: guarded by isStorageConfigured()
        accessKeyId: environment.STORAGE_ACCESS_KEY_ID!,
        // biome-ignore lint/style/noNonNullAssertion: guarded by isStorageConfigured()
        secretAccessKey: environment.STORAGE_SECRET_ACCESS_KEY!
      },
      ...(environment.STORAGE_ENDPOINT
        ? {
            endpoint: environment.STORAGE_ENDPOINT,
            forcePathStyle: true
          }
        : {})
    })
  }

  return client
}
