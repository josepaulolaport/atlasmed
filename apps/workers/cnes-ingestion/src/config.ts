export interface WorkerConfig {
  temporalAddress: string;
  temporalNamespace: string;
  taskQueue: string;
  cnesFtpMode: "mock" | "ftp";
  archiveBackend: "local" | "minio" | "s3";
  archiveLocalPath: string;
  archiveS3Bucket?: string;
  archiveS3Region?: string;
  archiveS3Endpoint?: string;
  archiveS3AccessKeyId?: string;
  archiveS3SecretAccessKey?: string;
  loadMode: "ftp" | "dev";
  extractDir: string;
  pythonBin: string;
  importScript?: string;
  validationRowTolerancePct: number;
  devLoadSourceSchema: string;
  loadConcurrency: number;
}

const DEFAULT_CNES_IMPORT_SCRIPT =
  "/Users/josepaulolaport/Documents/projects/cnes_mapping/scripts/import_modular.py";

function resolveDefaultImportScript(): string | undefined {
  if (process.env.CNES_IMPORT_SCRIPT) {
    return process.env.CNES_IMPORT_SCRIPT;
  }

  try {
    if (Bun.file(DEFAULT_CNES_IMPORT_SCRIPT).size > 0) {
      return DEFAULT_CNES_IMPORT_SCRIPT;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    temporalAddress: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
    temporalNamespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "cnes-ingestion",
    cnesFtpMode: process.env.CNES_FTP_MODE === "ftp" ? "ftp" : "mock",
    archiveBackend: (process.env.CNES_ARCHIVE_BACKEND as WorkerConfig["archiveBackend"]) ?? "local",
    archiveLocalPath: process.env.CNES_ARCHIVE_LOCAL_PATH ?? "/tmp/atlasmed-cnes-archive",
    archiveS3Bucket: process.env.CNES_ARCHIVE_S3_BUCKET,
    archiveS3Region: process.env.CNES_ARCHIVE_S3_REGION,
    archiveS3Endpoint: process.env.CNES_ARCHIVE_S3_ENDPOINT,
    archiveS3AccessKeyId: process.env.CNES_ARCHIVE_S3_ACCESS_KEY_ID,
    archiveS3SecretAccessKey: process.env.CNES_ARCHIVE_S3_SECRET_ACCESS_KEY,
    loadMode: process.env.CNES_LOAD_MODE === "ftp" ? "ftp" : "dev",
    extractDir: process.env.CNES_EXTRACT_DIR ?? "/tmp/cnes-extract",
    pythonBin: process.env.CNES_PYTHON_BIN ?? "python3",
    importScript: resolveDefaultImportScript(),
    validationRowTolerancePct: Number(process.env.CNES_VALIDATION_ROW_TOLERANCE_PCT ?? "15"),
    devLoadSourceSchema: process.env.CNES_DEV_LOAD_SOURCE_SCHEMA ?? "mcp_test",
    loadConcurrency: Number(process.env.CNES_LOAD_CONCURRENCY ?? "4"),
  };
}

export function workflowIdForReference(ano: number, mes: number): string {
  return `cnes-ingestion-${ano}-${String(mes).padStart(2, "0")}`;
}
