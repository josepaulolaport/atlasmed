import './bootstrap-telemetry'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureArchiveBucket } from '@atlasmed/cnes-ingestion'
import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './activities/index'
import { loadWorkerConfig } from './config'
import { logger } from './logger'

async function run() {
  const config = loadWorkerConfig()

  if (config.archiveBackend === 's3' || config.archiveBackend === 'minio') {
    logger.info('Ensuring archive bucket exists', { bucket: config.archiveS3Bucket })
    await ensureArchiveBucket({
      bucket: config.archiveS3Bucket,
      region: config.archiveS3Region,
      endpoint: config.archiveS3Endpoint,
      accessKeyId: config.archiveS3AccessKeyId,
      secretAccessKey: config.archiveS3SecretAccessKey,
      forcePathStyle: Boolean(config.archiveS3Endpoint)
    })
    logger.info('Archive bucket ensured successfully')
  }

  const connection = await NativeConnection.connect({
    address: config.temporalAddress
  })

  const workflowsPath = join(dirname(fileURLToPath(import.meta.url)), 'workflows')

  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: config.taskQueue,
    workflowsPath,
    activities
  })

  logger.info('CNES ingestion worker started', {
    temporalAddress: config.temporalAddress,
    taskQueue: config.taskQueue
  })

  await worker.run()
}

run().catch((error) => {
  logger.error('CNES ingestion worker failed', error)
  process.exit(1)
})
