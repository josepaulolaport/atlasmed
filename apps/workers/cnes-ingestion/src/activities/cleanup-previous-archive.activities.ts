import {
  archiveKeyForReference,
  compareReferences,
  previousReference
} from '@atlasmed/cnes-ingestion'
import { loadWorkerConfig } from '../config'

export async function cleanupPreviousArchiveActivity(input: {
  ano: number
  mes: number
}): Promise<{ deleted: boolean; deletedKey?: string }> {
  const config = loadWorkerConfig()
  const current = { ano: input.ano, mes: input.mes }
  const previous = previousReference(current)
  if (!previous) {
    return { deleted: false }
  }

  if (compareReferences(current, previous) <= 0) {
    return { deleted: false }
  }

  const { createArchiveAdapter } = await import('@atlasmed/cnes-ingestion')
  const archive = createArchiveAdapter({
    backend: config.archiveBackend,
    localPath: config.archiveLocalPath,
    bucket: config.archiveS3Bucket,
    region: config.archiveS3Region,
    endpoint: config.archiveS3Endpoint,
    accessKeyId: config.archiveS3AccessKeyId,
    secretAccessKey: config.archiveS3SecretAccessKey
  })

  const manifest = await archive.getManifest(previous)
  if (!manifest) {
    return { deleted: false }
  }

  const deletedKey = archiveKeyForReference(previous)
  await archive.deleteFile(deletedKey)

  const version = `${previous.ano}${String(previous.mes).padStart(2, '0')}`
  await archive.deleteFile(`cnes/${version}/manifest.json`)

  return { deleted: true, deletedKey }
}
