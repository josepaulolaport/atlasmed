import { environment } from '@atlasmed/config'

export interface WorkerConfig {
  temporalAddress: string
  temporalNamespace: string
  taskQueue: string
  cnesFtpMode: 'mock' | 'ftp'
  archiveBackend: 'local' | 'minio' | 's3'
  archiveLocalPath: string
  archiveS3Bucket?: string
  archiveS3Region?: string
  archiveS3Endpoint?: string
  archiveS3AccessKeyId?: string
  archiveS3SecretAccessKey?: string
  loadMode: 'ftp' | 'dev'
  extractDir: string
  pythonBin: string
  importScript?: string
  validationRowTolerancePct: number
  devLoadSourceSchema: string
  loadConcurrency: number
}

const DEFAULT_CNES_IMPORT_SCRIPT =
  '/Users/josepaulolaport/Documents/projects/cnes_mapping/scripts/import_modular.py'

function resolveDefaultImportScript(): string | undefined {
  if (environment.CNES_IMPORT_SCRIPT) {
    return environment.CNES_IMPORT_SCRIPT
  }

  try {
    if (Bun.file(DEFAULT_CNES_IMPORT_SCRIPT).size > 0) {
      return DEFAULT_CNES_IMPORT_SCRIPT
    }
  } catch {
    return undefined
  }

  return undefined
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    temporalAddress: environment.TEMPORAL_ADDRESS,
    temporalNamespace: environment.TEMPORAL_NAMESPACE,
    taskQueue: environment.TEMPORAL_TASK_QUEUE,
    cnesFtpMode: environment.CNES_FTP_MODE,
    archiveBackend: environment.CNES_ARCHIVE_BACKEND,
    archiveLocalPath: environment.CNES_ARCHIVE_LOCAL_PATH,
    archiveS3Bucket: environment.CNES_ARCHIVE_S3_BUCKET,
    archiveS3Region: environment.CNES_ARCHIVE_S3_REGION,
    archiveS3Endpoint: environment.CNES_ARCHIVE_S3_ENDPOINT,
    archiveS3AccessKeyId: environment.CNES_ARCHIVE_S3_ACCESS_KEY_ID,
    archiveS3SecretAccessKey: environment.CNES_ARCHIVE_S3_SECRET_ACCESS_KEY,
    loadMode: environment.CNES_LOAD_MODE,
    extractDir: environment.CNES_EXTRACT_DIR,
    pythonBin: environment.CNES_PYTHON_BIN,
    importScript: resolveDefaultImportScript(),
    validationRowTolerancePct: environment.CNES_VALIDATION_ROW_TOLERANCE_PCT,
    devLoadSourceSchema: environment.CNES_DEV_LOAD_SOURCE_SCHEMA,
    loadConcurrency: environment.CNES_LOAD_CONCURRENCY
  }
}

export function workflowIdForReference(ano: number, mes: number): string {
  return `cnes-ingestion-${ano}-${String(mes).padStart(2, '0')}`
}
