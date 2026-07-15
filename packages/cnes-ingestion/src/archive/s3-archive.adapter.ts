import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import type { CnesReference } from '../ftp/cnes-ftp.port'
import { cnesVersionSuffix } from '../ftp/cnes-ftp.utils'
import type { ArchiveManifest, ArchiveStoragePort } from './archive-storage.port'

function manifestKey(reference: CnesReference): string {
  const version = cnesVersionSuffix(reference)
  return `cnes/${version}/manifest.json`
}

function bodyToUint8Array(body: unknown): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    return Promise.resolve(body)
  }

  if (typeof body === 'string') {
    return Promise.resolve(new TextEncoder().encode(body))
  }

  if (body && typeof body === 'object' && 'transformToByteArray' in body) {
    return (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
  }

  throw new Error('Unsupported S3 response body type')
}

export class S3ArchiveAdapter implements ArchiveStoragePort {
  private readonly client: S3Client

  constructor(
    private readonly config: {
      bucket: string
      region?: string
      endpoint?: string
      accessKeyId?: string
      secretAccessKey?: string
      forcePathStyle?: boolean
    }
  ) {
    this.client = new S3Client({
      region: this.config.region ?? 'us-east-1',
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle ?? Boolean(this.config.endpoint),
      credentials:
        this.config.accessKeyId && this.config.secretAccessKey
          ? {
              accessKeyId: this.config.accessKeyId,
              secretAccessKey: this.config.secretAccessKey
            }
          : undefined
    })
  }

  resolvePath(key: string): string {
    return `s3://${this.config.bucket}/${key}`
  }

  async saveManifest(manifest: ArchiveManifest): Promise<void> {
    await this.writeFile(manifestKey(manifest.reference), JSON.stringify(manifest, null, 2))
  }

  async getManifest(reference: CnesReference): Promise<ArchiveManifest | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: manifestKey(reference)
        })
      )
      const bytes = await bodyToUint8Array(response.Body)
      return JSON.parse(new TextDecoder().decode(bytes)) as ArchiveManifest
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
        return null
      }
      if (error && typeof error === 'object' && '$metadata' in error) {
        const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        if (metadata?.httpStatusCode === 404) {
          return null
        }
      }
      throw error
    }
  }

  async writeFile(key: string, content: Uint8Array | string): Promise<void> {
    const body = typeof content === 'string' ? content : content
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body
      })
    )
  }

  async readFile(key: string): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      })
    )
    return bodyToUint8Array(response.Body)
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key
      })
    )
  }
}
