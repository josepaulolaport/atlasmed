import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  archiveKeyForReference,
  cnesVersionSuffix,
  extractedFolderName,
} from "@atlasmed/cnes-ingestion";
import { loadWorkerConfig } from "../config";
import { updateIngestionRunPhase } from "./discover-download.activities";

export async function resolveCnesCsvDir(
  extractRoot: string,
  reference: { ano: number; mes: number }
): Promise<string> {
  const nested = join(extractRoot, extractedFolderName(reference));
  try {
    const nestedStat = await stat(nested);
    if (nestedStat.isDirectory()) {
      return nested;
    }
  } catch {
    // fall through to extract root
  }

  return extractRoot;
}

export async function extractMonthlyArchiveActivity(input: {
  ingestionRunId: string;
  ano: number;
  mes: number;
}): Promise<{ extractPath: string; csvFileCount: number }> {
  await updateIngestionRunPhase(input.ingestionRunId, "EXTRACTING");

  const config = loadWorkerConfig();
  const reference = { ano: input.ano, mes: input.mes };
  const version = cnesVersionSuffix(reference);
  const { createArchiveAdapter } = await import("@atlasmed/cnes-ingestion");
  const archive = createArchiveAdapter({
    backend: config.archiveBackend,
    localPath: config.archiveLocalPath,
    bucket: config.archiveS3Bucket,
    region: config.archiveS3Region,
    endpoint: config.archiveS3Endpoint,
    accessKeyId: config.archiveS3AccessKeyId,
    secretAccessKey: config.archiveS3SecretAccessKey,
  });

  const archiveKey = archiveKeyForReference(reference);
  const zipBytes = await archive.readFile(archiveKey);
  const extractRoot = join(config.extractDir, version);
  await rm(extractRoot, { recursive: true, force: true });
  await mkdir(extractRoot, { recursive: true });

  const tempZipPath = join(tmpdir(), `cnes-archive-${version}-${Bun.randomUUIDv7()}.zip`);
  await Bun.write(tempZipPath, zipBytes);

  try {
    const unzipProcess = Bun.spawn(["unzip", "-q", tempZipPath, "-d", extractRoot], {
      stderr: "pipe",
      stdout: "ignore",
    });
    const exitCode = await unzipProcess.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(unzipProcess.stderr).text();
      throw new Error(`Failed to extract CNES archive: ${stderr}`);
    }
  } finally {
    await rm(tempZipPath, { force: true });
  }

  const csvDir = await resolveCnesCsvDir(extractRoot, reference);
  const entries = await readdir(csvDir);
  const csvFileCount = entries.filter((name) => name.toLowerCase().endsWith(".csv")).length;

  return { extractPath: csvDir, csvFileCount };
}
