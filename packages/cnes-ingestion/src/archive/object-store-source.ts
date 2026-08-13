import { readCsvHeader, readCsvRecords } from "../parse/csv-stream";
import { sourceFileName, type CnesReference, type CnesSourceName } from "../cnes-files";
import type { CnesSource } from "../source";
import {
  dataOffsetFromLocalHeader,
  LOCAL_HEADER_PREFIX_BYTES,
  METHOD_DEFLATE,
  METHOD_STORED,
  parseCentralDirectory,
  readEndOfCentralDirectory,
  type ZipEntry,
} from "./zip-directory";

/**
 * Reads CNES CSVs out of an archive held in the object store.
 *
 * This is the half of ADR 0010 that needs seeking. S3 implements `Range`
 * correctly — which the DATASUS FTP endpoint did not, in a way that returned
 * short data rather than an error — so every read here is exact, and a short
 * read is a genuine fault rather than a routine hazard.
 */

/** Bytes read from the end of the object to locate the central directory. */
const TAIL_BYTES = 64 * 1024;

/**
 * The only capability this reader needs. Keeping it to two functions means the
 * tests can drive it from a buffer, and no S3 client is required to prove the
 * ZIP arithmetic.
 */
export interface RangeReadable {
  /** Total size of the object in bytes. */
  size(): Promise<number>;
  /** Bytes `[from, to]`, inclusive, exactly. */
  read(from: number, to: number): Promise<Uint8Array>;
}

export interface ArchiveVerification {
  sizeBytes: number;
  entryCount: number;
  /** Names of the entries the loader will read, with their offsets and sizes. */
  entries: ZipEntry[];
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Proves an object is a complete archive before anything trusts it.
 *
 * Structural rather than by size: the HTTPS fetch is chunked and declares no
 * `Content-Length`, so there is no expected number to compare against. What can
 * be checked is that the end-of-central-directory record parses, that every
 * entry it promises is present, and that its own arithmetic lands exactly on the
 * object's size — which a truncated upload cannot satisfy.
 */
export async function verifyArchive(
  readable: RangeReadable
): Promise<ArchiveVerification> {
  const size = await readable.size();
  if (size <= 0) throw new Error("archive object is empty");

  const tailFrom = Math.max(0, size - TAIL_BYTES);
  const tail = await readable.read(tailFrom, size - 1);
  if (tail.length !== size - tailFrom) {
    throw new Error(
      `short tail read: wanted ${size - tailFrom} bytes, got ${tail.length}`
    );
  }

  const location = readEndOfCentralDirectory(tail);
  if (!location) {
    throw new Error(
      `no end-of-central-directory record in the last ${TAIL_BYTES} bytes — the object is not a complete ZIP`
    );
  }

  // The record sits at the very end, so its own offsets must account for the
  // whole object. A truncated upload fails here rather than at inflate time.
  const impliedEnd = location.offset + location.size;
  if (impliedEnd > size) {
    throw new Error(
      `central directory claims to end at ${impliedEnd} but the object is ${size} bytes — truncated`
    );
  }

  const offsetInTail = location.offset - tailFrom;
  const bytes =
    offsetInTail >= 0 && offsetInTail + location.size <= tail.length
      ? tail
      : await readable.read(location.offset, location.offset + location.size - 1);
  const bytesStartAt = bytes === tail ? tailFrom : location.offset;

  // Throws unless every record's signature lands where the directory says and
  // the count matches the record.
  const entries = parseCentralDirectory({ bytes, bytesStartAt, location });

  return { sizeBytes: size, entryCount: entries.length, entries };
}

export interface ObjectStoreArchiveOptions {
  readable: RangeReadable;
  reference: CnesReference;
  /** Bytes per range request while streaming an entry. */
  chunkBytes?: number;
  onProgress?: (message: string, detail?: Record<string, unknown>) => void;
  /** Called as compressed bytes arrive, so an activity can heartbeat. */
  onBytes?: (compressedBytesRead: number) => void;
}

export interface ObjectStoreArchive extends CnesSource {
  entries: readonly ZipEntry[];
  verification: ArchiveVerification;
}

/** 8 MB: large enough that a 322 MB entry is ~40 requests, small enough to stream. */
const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;

export async function openArchiveFromObjectStore(
  options: ObjectStoreArchiveOptions
): Promise<ObjectStoreArchive> {
  const { readable, reference } = options;
  const chunkBytes = options.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  const log = options.onProgress ?? (() => {});

  const verification = await verifyArchive(readable);
  log("archive verified", {
    sizeBytes: verification.sizeBytes,
    entries: verification.entryCount,
  });

  function entryFor(name: CnesSourceName): ZipEntry {
    const fileName = sourceFileName(name, reference);
    const entry = verification.entries.find((e) => e.name === fileName);
    if (!entry) {
      throw new Error(`${fileName} is not in the archive — the export's layout changed`);
    }
    if (entry.method !== METHOD_DEFLATE && entry.method !== METHOD_STORED) {
      throw new Error(
        `${fileName} uses zip compression method ${entry.method}, which this reader cannot decode`
      );
    }
    return entry;
  }

  /** The entry's compressed bytes, fetched in chunks. */
  async function* compressedBytes(entry: ZipEntry): AsyncGenerator<Uint8Array> {
    // The local header repeats the name but may carry a different extra field,
    // so where the payload starts has to be read rather than assumed.
    const header = await readable.read(
      entry.localHeaderOffset,
      entry.localHeaderOffset + LOCAL_HEADER_PREFIX_BYTES - 1
    );
    const dataAt = dataOffsetFromLocalHeader({ entry, localHeader: header });

    let delivered = 0;
    while (delivered < entry.compressedSize) {
      const from = dataAt + delivered;
      const to = Math.min(from + chunkBytes, dataAt + entry.compressedSize) - 1;
      const chunk = await readable.read(from, to);
      if (chunk.length === 0) {
        throw new Error(
          `empty range read at ${from} of ${entry.name} — expected ${to - from + 1} bytes`
        );
      }
      delivered += chunk.length;
      options.onBytes?.(delivered);
      yield chunk;
    }
    if (delivered !== entry.compressedSize) {
      throw new Error(
        `short read on ${entry.name}: wanted ${entry.compressedSize}, got ${delivered}`
      );
    }
  }

  function toReadableStream(source: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = await source.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
      cancel(reason) {
        void source.return?.(reason);
      },
    });
  }

  async function* entryBytes(name: CnesSourceName): AsyncGenerator<Uint8Array> {
    const entry = entryFor(name);
    const compressed = compressedBytes(entry);
    if (entry.method === METHOD_STORED) {
      yield* compressed;
      return;
    }
    // `DecompressionStream` is typed against a narrower Uint8Array than the
    // generator produces; the runtime contract is identical.
    const inflated = toReadableStream(compressed).pipeThrough(
      new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<
        Uint8Array,
        Uint8Array
      >
    );
    for await (const chunk of inflated) yield chunk;
  }

  return {
    entries: verification.entries,
    verification,
    describe: `object store archive for ${reference.year}-${String(reference.month).padStart(2, "0")}`,
    header: (name) => readCsvHeader(entryBytes(name)),
    records: (name) => readCsvRecords(entryBytes(name)),
  };
}
