/**
 * Just enough ZIP to read six entries out of a 725 MB remote archive without
 * downloading it.
 *
 * The central directory sits at the end of the file and carries every entry's
 * offset and compressed size, so entries can be fetched by byte range and in any
 * order. That matters here for two measured reasons (202605 dump):
 *
 * - **All 109 entries set the data-descriptor flag**, so their *local* headers
 *   carry zero for CRC and both sizes. A reader that trusted local headers could
 *   not tell where one entry ends, and would have to inflate every entry just to
 *   find the next.
 * - **The file order is wrong for us.** `tbDadosProfissionalSus` precedes
 *   `tbCargaHorariaSus`, but the professional filter needs the carga scan first.
 *   Sequential reading would force a second pass over 725 MB.
 */

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;

/** Deflate — every entry in the CNES archive that carries real content. */
export const METHOD_DEFLATE = 8;
/** No compression. Zippers fall back to this when deflating would not pay. */
export const METHOD_STORED = 0;

export interface ZipEntry {
  name: string;
  /** Compression method; see {@link METHOD_DEFLATE}. */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Absolute offset of the local file header, not of the data. */
  localHeaderOffset: number;
}

export interface CentralDirectoryLocation {
  offset: number;
  size: number;
  entryCount: number;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Finds the end-of-central-directory record in a slice taken from the end of the
 * archive. Returns `null` when the slice does not reach back far enough — the
 * caller should refetch a larger tail rather than guess.
 */
export function readEndOfCentralDirectory(
  tail: Uint8Array
): CentralDirectoryLocation | null {
  const dv = view(tail);
  // Scanned backwards: the record is last, bar an optional trailing comment.
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (dv.getUint32(i, true) !== END_OF_CENTRAL_DIRECTORY) continue;
    return {
      entryCount: dv.getUint16(i + 10, true),
      size: dv.getUint32(i + 12, true),
      offset: dv.getUint32(i + 16, true),
    };
  }
  return null;
}

/**
 * Parses central directory records out of `bytes`, which must cover
 * `[location.offset, location.offset + location.size)`. `bytesStartAt` is where
 * `bytes` begins in the archive.
 */
export function parseCentralDirectory(input: {
  bytes: Uint8Array;
  bytesStartAt: number;
  location: CentralDirectoryLocation;
}): ZipEntry[] {
  const { bytes, bytesStartAt, location } = input;
  const from = location.offset - bytesStartAt;
  if (from < 0 || from + location.size > bytes.length) {
    throw new Error(
      `central directory at ${location.offset}+${location.size} is not inside the fetched slice ` +
        `[${bytesStartAt}, ${bytesStartAt + bytes.length})`
    );
  }

  const dv = view(bytes);
  const entries: ZipEntry[] = [];
  let at = from;
  while (at + 46 <= from + location.size) {
    if (dv.getUint32(at, true) !== CENTRAL_FILE_HEADER) break;
    const nameLength = dv.getUint16(at + 28, true);
    const extraLength = dv.getUint16(at + 30, true);
    const commentLength = dv.getUint16(at + 32, true);
    entries.push({
      name: new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      method: dv.getUint16(at + 10, true),
      compressedSize: dv.getUint32(at + 20, true),
      uncompressedSize: dv.getUint32(at + 24, true),
      localHeaderOffset: dv.getUint32(at + 42, true),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }

  if (entries.length !== location.entryCount) {
    throw new Error(
      `expected ${location.entryCount} zip entries, parsed ${entries.length}`
    );
  }
  return entries;
}

/**
 * Where an entry's compressed bytes begin, given its 30-byte local header.
 *
 * The local header must be read rather than assumed: its extra field can differ
 * in length from the central directory's, so the data does not sit at a fixed
 * distance from `localHeaderOffset`.
 */
export function dataOffsetFromLocalHeader(input: {
  entry: ZipEntry;
  localHeader: Uint8Array;
}): number {
  const dv = view(input.localHeader);
  if (dv.getUint32(0, true) !== LOCAL_FILE_HEADER) {
    throw new Error(`no local file header at ${input.entry.localHeaderOffset}`);
  }
  return (
    input.entry.localHeaderOffset +
    30 +
    dv.getUint16(26, true) +
    dv.getUint16(28, true)
  );
}

/** Bytes of the local header needed before {@link dataOffsetFromLocalHeader}. */
export const LOCAL_HEADER_PREFIX_BYTES = 30;
