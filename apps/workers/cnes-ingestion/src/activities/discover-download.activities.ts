import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../infrastructure/prisma";
import { loadWorkerConfig } from "../config";

export async function updateIngestionRunPhase(
  ingestionRunId: string,
  phase: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await prisma.ingestionRun.update({
    where: { id: ingestionRunId },
    data: {
      phase: phase as never,
      phaseStartedAt: new Date(),
      ...(extra ?? {}),
    },
  });
}

export async function discoverLatestReferenceActivity(input: {
  ingestionRunId: string;
  ano?: number;
  mes?: number;
}): Promise<{ ano: number; mes: number }> {
  await updateIngestionRunPhase(input.ingestionRunId, "DISCOVERING");

  if (input.ano && input.mes) {
    await prisma.ingestionRun.update({
      where: { id: input.ingestionRunId },
      data: {
        referenceAno: input.ano,
        referenceMes: input.mes,
      },
    });
    return { ano: input.ano, mes: input.mes };
  }

  const config = loadWorkerConfig();
  const { createCnesFtpAdapter } = await import("@atlasmed/cnes-ingestion");
  const ftp = createCnesFtpAdapter({ mode: config.cnesFtpMode });
  const reference = await ftp.discoverLatest();

  await prisma.ingestionRun.update({
    where: { id: input.ingestionRunId },
    data: {
      referenceAno: reference.ano,
      referenceMes: reference.mes,
    },
  });

  return reference;
}

export async function downloadRawFilesActivity(input: {
  ingestionRunId: string;
  ano: number;
  mes: number;
}): Promise<{ fileCount: number }> {
  await updateIngestionRunPhase(input.ingestionRunId, "DOWNLOADING");

  const config = loadWorkerConfig();
  const { archiveKeyForReference, createArchiveAdapter, createCnesFtpAdapter, checksumContent } =
    await import("@atlasmed/cnes-ingestion");

  const reference = { ano: input.ano, mes: input.mes };
  const ftp = createCnesFtpAdapter({
    mode: config.cnesFtpMode,
    reference,
  });
  const archive = createArchiveAdapter({
    backend: config.archiveBackend,
    localPath: config.archiveLocalPath,
    bucket: config.archiveS3Bucket,
    region: config.archiveS3Region,
    endpoint: config.archiveS3Endpoint,
    accessKeyId: config.archiveS3AccessKeyId,
    secretAccessKey: config.archiveS3SecretAccessKey,
  });
  const files = await ftp.listFiles(reference);
  const tempDir = join(tmpdir(), `cnes-download-${Bun.randomUUIDv7()}`);
  await mkdir(tempDir, { recursive: true });

  const manifestFiles = [];
  try {
    for (const file of files) {
      const key = archiveKeyForReference(reference);
      const tempPath = join(tempDir, file.name);
      await ftp.downloadFile(file, tempPath);
      const content = new Uint8Array(await Bun.file(tempPath).arrayBuffer());
      await archive.writeFile(key, content);
      manifestFiles.push({
        key,
        path: file.path,
        checksum: checksumContent(content),
        size: content.byteLength,
      });
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  const manifest = {
    reference,
    createdAt: new Date().toISOString(),
    files: manifestFiles,
  };

  await archive.saveManifest(manifest);
  await prisma.ingestionRun.update({
    where: { id: input.ingestionRunId },
    data: { archiveManifest: manifest as object },
  });

  return { fileCount: manifestFiles.length };
}

export async function parseAndNormalizeActivity(input: {
  ingestionRunId: string;
  ano: number;
  mes: number;
}): Promise<{ parsedFiles: number; parsedRows: number }> {
  const config = loadWorkerConfig();
  if (config.loadMode !== "dev") {
    return { parsedFiles: 0, parsedRows: 0 };
  }

  await updateIngestionRunPhase(input.ingestionRunId, "PARSING");

  const { createArchiveAdapter, parseCnesFile } = await import("@atlasmed/cnes-ingestion");
  const archive = createArchiveAdapter({
    backend: config.archiveBackend,
    localPath: config.archiveLocalPath,
    bucket: config.archiveS3Bucket,
    region: config.archiveS3Region,
    endpoint: config.archiveS3Endpoint,
    accessKeyId: config.archiveS3AccessKeyId,
    secretAccessKey: config.archiveS3SecretAccessKey,
  });

  const manifest = await archive.getManifest({ ano: input.ano, mes: input.mes });
  if (!manifest) {
    return { parsedFiles: 0, parsedRows: 0 };
  }

  let parsedFiles = 0;
  let parsedRows = 0;

  for (const file of manifest.files) {
    const chunks = await parseCnesFile({
      filePath: archive.resolvePath(file.key),
      referenceAno: input.ano,
      referenceMes: input.mes,
    });

    if (chunks.length === 0) {
      continue;
    }

    parsedFiles += 1;
    parsedRows += chunks.reduce((total, chunk) => total + chunk.rowCount, 0);
  }

  return { parsedFiles, parsedRows };
}
