import { environment } from "@atlasmed/config";
import {
  archiveFileName,
  CNES_SOURCE_STEMS,
  formatReference,
  loadRegistryFromCsv,
  openCnesArchive,
  sourceFileName,
  type CnesReference,
  type CnesSourceName,
  type LoadRegistryResult,
} from "@atlasmed/cnes-ingestion";
import { db } from "../infrastructure/db";
import { logger } from "../logger";
import { setCnesRunPhase } from "./cnes-run-ops";
import { promotionGateFor } from "./validate-promotion";

/**
 * One monthly CNES load, start to finish.
 *
 * Deliberately a single activity rather than one per phase. The scan builds maps
 * keyed by establishment and SUS id that the later steps consume; splitting the
 * phases across activities would mean serialising those through Temporal, whose
 * payload limit is 4 MB — the scoped roster alone exceeds that in a bad month.
 * Phases are still recorded, from inside, so an operator can see where a run is.
 *
 * The measured cost of the whole read is minutes, not hours: the largest entry
 * (322.7 MB compressed, 907.2 MB inflated, 7.76 M rows) fetched and parsed in
 * 81 s.
 */

export interface IngestCnesRegistryInput {
  runId: number;
  reference: CnesReference;
}

export interface CnesArchiveManifest {
  archive: string;
  sizeBytes: number;
  entryCount: number;
  /** Only the entries this run actually read. */
  read: {
    name: string;
    offset: number;
    compressedBytes: number;
    uncompressedBytes: number;
  }[];
}

export interface IngestCnesRegistryOutput extends LoadRegistryResult {
  reference: string;
  archive: string;
  archiveManifest: CnesArchiveManifest;
}

/** How often the activity tells Temporal it is alive, in compressed bytes read. */
const HEARTBEAT_EVERY_BYTES = 4 * 1024 * 1024;

export async function ingestCnesRegistry(
  input: IngestCnesRegistryInput,
  heartbeat: (detail: unknown) => void = () => {}
): Promise<IngestCnesRegistryOutput> {
  const reference = formatReference(input.reference);
  const fileName = archiveFileName(input.reference);

  await setCnesRunPhase({ runId: input.runId, phase: "DOWNLOADING" });

  let bytesRead = 0;
  let lastHeartbeatAt = 0;
  const source = await openCnesArchive({
    location: {
      host: environment.CNES_FTP_HOST,
      directory: environment.CNES_FTP_DIRECTORY,
    },
    reference: input.reference,
    archiveFileName: fileName,
    onProgress: (message, detail) => {
      logger.info(`cnes.ingestion.archive.${message.replaceAll(" ", "_")}`, {
        ...detail,
        reference,
      });
      // Opening the archive happens before a single byte of payload arrives, and
      // its retries sleep for up to 30 s. Without a heartbeat here the activity
      // is silent through the whole open and Temporal kills it as hung — which
      // is exactly what happened on the first run with backoff enabled.
      heartbeat({ reference, step: message, ...detail });
    },
    onBytes: (total) => {
      bytesRead = total;
      if (total - lastHeartbeatAt < HEARTBEAT_EVERY_BYTES) return;
      lastHeartbeatAt = total;
      // A silent activity is indistinguishable from a hung one, and the entries
      // are large enough that silence would otherwise last minutes.
      heartbeat({ reference, compressedBytesRead: total });
    },
  });

  await setCnesRunPhase({ runId: input.runId, phase: "LOADING" });

  const result = await loadRegistryFromCsv({
    db,
    source,
    reference: input.reference,
    beforePromote: promotionGateFor(input.runId),
    onProgress: (message, detail) => {
      logger.info(`cnes.ingestion.${message.replaceAll(" ", "_")}`, {
        ...detail,
        reference,
      });
      heartbeat({ reference, step: message, compressedBytesRead: bytesRead });
    },
  });

  await setCnesRunPhase({ runId: input.runId, phase: "PROMOTING" });

  const wanted = new Set(
    (Object.keys(CNES_SOURCE_STEMS) as CnesSourceName[]).map((name) =>
      sourceFileName(name, input.reference)
    )
  );
  const archiveManifest: CnesArchiveManifest = {
    archive: fileName,
    sizeBytes: source.entries.reduce((n, e) => n + e.compressedSize, 0),
    entryCount: source.entries.length,
    read: source.entries
      .filter((e) => wanted.has(e.name))
      .map((e) => ({
        name: e.name,
        offset: e.localHeaderOffset,
        compressedBytes: e.compressedSize,
        uncompressedBytes: e.uncompressedSize,
      })),
  };

  return { ...result, reference, archive: fileName, archiveManifest };
}
