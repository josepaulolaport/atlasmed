import { PassThrough, Writable } from "node:stream";
import { Client } from "basic-ftp";
import { readCsvHeader, readCsvRecords } from "../parse/csv-stream";
import {
  CNES_REFERENCE_PATTERN,
  parseReference,
  sourceFileName,
  type CnesReference,
  type CnesSourceName,
} from "../cnes-files";
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
 * Reads CNES CSVs straight out of the remote archive.
 *
 * Nothing is written to disk and nothing is staged: each entry is fetched by
 * byte range, inflated as it arrives, and parsed row by row. The six entries we
 * read are ~548 MB compressed out of a 725 MB archive that would be 2.87 GB
 * extracted.
 *
 * **Retry granularity is one entry, not one range.** Deflate has no resumable
 * mid-stream state, so a connection lost 200 MB into an entry has to restart
 * that entry — there is no way to resume inflation from a byte offset without
 * having inflated everything before it. Entries are independent, so a failure
 * costs one entry rather than the archive.
 *
 * **One login per entry, and it is the library that forces it.** Reusing a
 * single control connection would be better — servers rate-limit logins, not
 * the ephemeral data connections — and basic-ftp reuses one happily across
 * transfers that run to completion. But every read here is bounded, and FTP has
 * no way to bound one: `REST` says where a transfer starts and nothing says
 * where it ends, so a bounded read must abandon its transfer. After that
 * basic-ftp does not resynchronise the control connection and the next `RETR`
 * returns nothing. Measured in `connection-reuse.test.ts` against a local
 * server; if a future version fixes it, that test fails and this can become a
 * single login for the whole archive.
 */

/** Bytes fetched from the end of the archive to find the central directory. */
const TAIL_BYTES = 64 * 1024;

/**
 * Backoff between attempts.
 *
 * The origin refuses in spells rather than at random: a run that hits one gets
 * every immediate retry refused too, which is how four attempts were spent in
 * under a second and the read failed anyway. Waiting is the whole remedy.
 */
const RETRY_BACKOFF_MS = [2_000, 8_000, 30_000] as const;

function backoffFor(attempt: number): number {
  return RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length) - 1]!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ArchiveLocation {
  host: string;
  /** Directory holding the monthly archives, e.g. `/cnes`. */
  directory: string;
  user?: string;
  password?: string;
  secure?: boolean;
}

export interface ArchiveSourceOptions {
  location: ArchiveLocation;
  reference: CnesReference;
  archiveFileName: string;
  /** Attempts per entry before giving up. */
  maxAttempts?: number;
  onProgress?: (message: string, detail?: Record<string, unknown>) => void;
  /** Called as bytes arrive, so a Temporal activity can heartbeat. */
  onBytes?: (compressedBytesRead: number) => void;
}

async function withClient<T>(
  location: ArchiveLocation,
  run: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client(120_000);
  try {
    await client.access({
      host: location.host,
      user: location.user ?? "anonymous",
      password: location.password ?? "anonymous@",
      secure: location.secure ?? false,
    });
    /**
     * Force binary before any transfer.
     *
     * Correct practice for a ZIP either way — an ASCII transfer rewrites line
     * endings and shortens the payload silently.
     *
     * **It did not fix the truncation this reader hits**, so do not read it as
     * the explanation: with `TYPE I` set, the same range still returned 59744 of
     * 65536 bytes on eight consecutive attempts, while curl read all 65536 of
     * the identical range minutes earlier. Kept as hardening, not as a fix.
     */
    await client.send("TYPE I");
    return await run(client);
  } finally {
    client.close();
  }
}

/** Collects a bounded byte range. Used for the tail and for local headers. */
function collector(limit: number) {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let done = false;
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      if (done) return callback();
      const take = Math.min(limit - total, chunk.length);
      if (take > 0) {
        chunks.push(new Uint8Array(chunk.subarray(0, take)));
        total += take;
      }
      if (total >= limit) {
        done = true;
        // Ends the transfer: basic-ftp sees the sink close and stops pulling.
        this.destroy();
      }
      callback();
    },
  });
  return {
    stream,
    get isComplete() {
      return total >= limit;
    },
    bytes(): Uint8Array {
      const out = new Uint8Array(total);
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.length;
      }
      return out;
    },
  };
}

async function readRange(input: {
  location: ArchiveLocation;
  path: string;
  from: number;
  length: number;
}): Promise<Uint8Array> {
  return withClient(input.location, async (client) => {
    const sink = collector(input.length);
    try {
      await client.downloadTo(sink.stream, input.path, input.from);
    } catch (error) {
      // Destroying the sink at the limit aborts the transfer by design; that
      // surfaces as an error even though the bytes we wanted all arrived.
      if (!sink.isComplete) throw error;
    }
    const bytes = sink.bytes();
    /**
     * Always strict. This origin truncates transfers intermittently, and a
     * short read that is quietly accepted becomes a wrong answer later rather
     * than a retry now — a truncated tail stopped covering the central
     * directory, which sent the reader down a slower path against the same
     * unreliable server instead of simply trying again.
     */
    if (!sink.isComplete) {
      throw new Error(
        `short read: wanted ${input.length} bytes from ${input.from}, got ${bytes.length}`
      );
    }
    return bytes;
  });
}

/**
 * The same range, but yielded as it arrives.
 *
 * {@link readRange} is fine for a 30-byte local header and a 64 KB tail. The
 * entry payloads are up to 322 MB compressed and nine hundred inflated, so
 * buffering one would put back the memory cost this whole design exists to
 * avoid.
 */
async function* streamRange(input: {
  location: ArchiveLocation;
  path: string;
  from: number;
  length: number;
  /**
   * Do not throw when fewer bytes arrive than were asked for.
   *
   * Set by the entry reader, which over-requests because a local header's extra
   * field has an unknown size until it is read. {@link skipLocalHeader} owes the
   * real accounting and enforces it there.
   */
  tolerateShort?: boolean;
  onChunk?: (total: number) => void;
}): AsyncGenerator<Uint8Array> {
  const client = new Client(120_000);
  const sink = new PassThrough();
  let transfer: Promise<unknown> | null = null;
  let transferError: unknown;
  let total = 0;
  try {
    await client.access({
      host: input.location.host,
      user: input.location.user ?? "anonymous",
      password: input.location.password ?? "anonymous@",
      secure: input.location.secure ?? false,
    });
    // Binary, for the same reason as in `withClient`: an ASCII transfer of a ZIP
    // silently delivers fewer bytes than it was asked for.
    await client.send("TYPE I");
    // Not awaited: the bytes have to be consumed for the transfer to progress.
    // The rejection is kept rather than dropped — closing the client early is how
    // a bounded read *ends*, so the rejection is usually meaningless, but when the
    // transfer never delivers anything it is the only account of why. The first
    // real run reported `short read … got 0` with no cause because this was a
    // bare `.catch(() => undefined)`.
    transfer = client.downloadTo(sink, input.path, input.from).catch((error) => {
      transferError = error;
    });

    for await (const chunk of sink) {
      const bytes = chunk as Buffer;
      const take = Math.min(input.length - total, bytes.length);
      if (take > 0) {
        total += take;
        input.onChunk?.(total);
        yield new Uint8Array(bytes.subarray(0, take));
      }
      if (total >= input.length) break;
    }

    if (total < input.length && !input.tolerateShort) {
      // Wait for the transfer to settle so its rejection, if any, is available —
      // it is the diagnosis, and without it a short read says only "got 0".
      await transfer;
      const cause =
        transferError instanceof Error
          ? transferError.message
          : transferError !== undefined
            ? String(transferError)
            : "transfer ended without an error";
      throw new Error(
        `short read: wanted ${input.length} bytes from ${input.from}, got ${total} (${cause})`
      );
    }
  } finally {
    sink.destroy();
    client.close();
    await transfer;
  }
}

/**
 * `ReadableStream.from` exists in Bun but is absent from its type definitions,
 * and the pull-based shape matters: it is what keeps the FTP transfer paced by
 * the inflater rather than racing ahead of it.
 */
function toReadableStream(
  source: AsyncGenerator<Uint8Array>
): ReadableStream<Uint8Array> {
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

/**
 * Retries an FTP round trip.
 *
 * The origin drops connections routinely — a real run saw two of three large
 * entries fail their first attempt, and an unretried `size()` killed a run before
 * it read a byte. Every conversation with this server needs to survive one.
 */
async function withRetry<T>(
  attempts: number,
  describe: string,
  log: (message: string, detail?: Record<string, unknown>) => void,
  run: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const waitMs = backoffFor(attempt);
      log("archive read failed, retrying", {
        step: describe,
        attempt,
        maxAttempts: attempts,
        waitMs,
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(waitMs);
    }
  }
  throw new Error(
    `${describe} failed after ${attempts} attempts: ` +
      (lastError instanceof Error ? lastError.message : String(lastError))
  );
}

/** A ZIP extra field is length-prefixed with 16 bits, so it cannot exceed this. */
const MAX_EXTRA_FIELD_BYTES = 65535;

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

/**
 * Turns a stream that starts at an entry's local header into just its payload.
 *
 * The prefix length is only knowable from the header itself — 30 fixed bytes,
 * then a name and an extra field whose size the central directory does not have
 * to agree on — so it is parsed from the first bytes of the same transfer rather
 * than fetched separately.
 *
 * Strictness lives here rather than in the transfer: the caller deliberately
 * over-requests (the extra field's size is unknown when the range is asked for),
 * so a short read is normal at the transfer level and only this function knows
 * how many payload bytes were actually owed.
 */
export async function* skipLocalHeader(
  source: AsyncGenerator<Uint8Array>,
  entry: ZipEntry
): AsyncGenerator<Uint8Array> {
  let pending: Uint8Array = new Uint8Array(0);
  let prefixBytes = -1;
  let skipped = 0;
  let emitted = 0;

  for await (const chunk of source) {
    let buffer = chunk;

    if (prefixBytes < 0) {
      pending = concat(pending, buffer);
      if (pending.length < LOCAL_HEADER_PREFIX_BYTES) continue;
      prefixBytes =
        dataOffsetFromLocalHeader({
          entry,
          localHeader: pending.subarray(0, LOCAL_HEADER_PREFIX_BYTES),
        }) - entry.localHeaderOffset;
      buffer = pending;
      pending = new Uint8Array(0);
    }

    if (skipped < prefixBytes) {
      const drop = Math.min(prefixBytes - skipped, buffer.length);
      skipped += drop;
      buffer = buffer.subarray(drop);
      if (buffer.length === 0) continue;
    }

    const take = Math.min(entry.compressedSize - emitted, buffer.length);
    if (take > 0) {
      emitted += take;
      yield buffer.subarray(0, take);
    }
    if (emitted >= entry.compressedSize) return;
  }

  if (emitted < entry.compressedSize) {
    throw new Error(
      `short read on ${entry.name}: wanted ${entry.compressedSize} compressed bytes, got ${emitted}`
    );
  }
}

export interface CnesArchive extends CnesSource {
  entries: readonly ZipEntry[];
}

/**
 * Every competence DATASUS is currently publishing, newest first.
 *
 * Listing beats guessing a filename from today's date: the export is published
 * on no fixed day, so a date-derived guess is wrong for part of every month and
 * indistinguishable from an outage.
 */
export async function listCnesReferences(
  location: ArchiveLocation
): Promise<CnesReference[]> {
  const listing = await withClient(location, (client) =>
    client.list(location.directory)
  );
  const references: CnesReference[] = [];
  for (const item of listing) {
    const match = CNES_REFERENCE_PATTERN.exec(item.name);
    if (!match) continue;
    const reference = parseReference(match[1]!);
    if (reference) references.push(reference);
  }
  return references.sort(
    (a, b) => b.year * 12 + b.month - (a.year * 12 + a.month)
  );
}

/**
 * Opens the remote archive by reading its central directory, then serves entries
 * on demand. One round trip up front buys random access to all 109 entries.
 */
export async function openCnesArchive(
  options: ArchiveSourceOptions
): Promise<CnesArchive> {
  const { location, reference } = options;
  const path = `${location.directory.replace(/\/$/, "")}/${options.archiveFileName}`;
  const maxAttempts = options.maxAttempts ?? 4;
  const log = options.onProgress ?? (() => {});

  const size = await withRetry(maxAttempts, `size of ${path}`, log, () =>
    withClient(location, (client) => client.size(path))
  );
  const tailFrom = Math.max(0, size - TAIL_BYTES);
  /**
   * Strict, deliberately.
   *
   * This used to pass `toEndOfFile`, on the theory that FTP `SIZE` overstates
   * what a binary transfer delivers. It does not: byte `size - 1` is readable
   * and is the last byte of the end-of-central-directory record. So a tail
   * shorter than asked for is a **truncated transfer**, and tolerating it turned
   * a retryable read into an unrecoverable path — the short tail no longer
   * covered the directory, so the code fell through to fetching the directory
   * separately, which is a smaller and less reliable read against the same
   * flaky origin. Retrying the tail is both simpler and likelier to succeed.
   */
  const tail = await withRetry(maxAttempts, "central directory tail", log, () =>
    readRange({ location, path, from: tailFrom, length: size - tailFrom })
  );

  const cdLocation = readEndOfCentralDirectory(tail);
  if (!cdLocation) {
    throw new Error(
      `no end-of-central-directory record in the last ${TAIL_BYTES} bytes of ${path}`
    );
  }

  /**
   * Prefer the bytes already in hand; refetch only if the directory is not
   * wholly inside them.
   *
   * The check is on *coverage*, not just on the start offset: a tail that begins
   * before the directory but ends short of it would otherwise be parsed as if it
   * were complete. Refetching costs another connection, and this origin
   * throttles on connection churn, so it is worth avoiding when the tail already
   * has what we need.
   */
  const offsetInTail = cdLocation.offset - tailFrom;
  const tailCoversDirectory =
    offsetInTail >= 0 && offsetInTail + cdLocation.size <= tail.length;

  const entries = await withRetry(maxAttempts, "central directory", log, async () => {
    if (tailCoversDirectory) {
      return parseCentralDirectory({
        bytes: tail,
        bytesStartAt: tailFrom,
        location: cdLocation,
      });
    }
    const bytes = await readRange({
      location,
      path,
      from: cdLocation.offset,
      length: cdLocation.size,
    });
    return parseCentralDirectory({
      bytes,
      bytesStartAt: cdLocation.offset,
      location: cdLocation,
    });
  });
  log("archive opened", { path, size, entries: entries.length });

  function entryFor(name: CnesSourceName): ZipEntry {
    const fileName = sourceFileName(name, reference);
    const entry = entries.find((e) => e.name === fileName);
    if (!entry) {
      throw new Error(
        `${fileName} is not in ${options.archiveFileName} — the export's layout changed`
      );
    }
    if (entry.method !== METHOD_DEFLATE && entry.method !== METHOD_STORED) {
      throw new Error(
        `${fileName} uses zip compression method ${entry.method}, which this reader cannot decode`
      );
    }
    return entry;
  }

  /** Inflated bytes of one entry. Restarts the entry on a failed attempt. */
  async function* entryBytes(name: CnesSourceName): AsyncGenerator<Uint8Array> {
    const entry = entryFor(name);
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        /**
         * One transfer per entry, not two.
         *
         * The local header has to be read to find where the data starts — its
         * extra field can differ in length from the central directory's — but it
         * sits immediately before that data, so both come out of a single
         * connection: start at the header, consume it, drop the variable-length
         * remainder, and what follows is the payload.
         *
         * Fetching the header separately doubled the connection count for no
         * benefit, and this origin rate-limits per IP.
         */
        const compressed = skipLocalHeader(
          streamRange({
            location,
            path,
            from: entry.localHeaderOffset,
            length:
              LOCAL_HEADER_PREFIX_BYTES +
              MAX_EXTRA_FIELD_BYTES +
              entry.compressedSize,
            tolerateShort: true,
            onChunk: options.onBytes,
          }),
          entry
        );
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
        return;
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;
        const waitMs = backoffFor(attempt);
        log("entry read failed, retrying", {
          entry: entry.name,
          attempt,
          maxAttempts,
          waitMs,
          error: error instanceof Error ? error.message : String(error),
        });
        await sleep(waitMs);
      }
    }
    throw new Error(
      `could not read ${entry.name} after ${maxAttempts} attempts: ` +
        (lastError instanceof Error ? lastError.message : String(lastError))
    );
  }

  return {
    entries,
    describe: `ftp://${location.host}${path}`,
    header: (name) => readCsvHeader(entryBytes(name)),
    records: (name) => readCsvRecords(entryBytes(name)),
  };
}
