/**
 * Streaming reader for the CNES CSV exports.
 *
 * The two files that matter are large — `tbDadosProfissionalSus` is ~907 MB and
 * `tbCargaHorariaSus` ~825 MB in the 202605 dump — so nothing here may hold a
 * whole file, a whole column, or a whole row set in memory. Callers get an async
 * iterator and are expected to filter as they go.
 *
 * Format quirks the parser has to survive, all observed in the real dump:
 * - **latin-1, not UTF-8.** Decoding as UTF-8 throws on the first accented name.
 * - `;` delimiter, `"` quoting, doubled `""` for a literal quote.
 * - CRLF line endings.
 * - A quoted field may contain `;` or a newline, so line-splitting before
 *   parsing is wrong.
 */

export interface CsvStreamOptions {
  /** Defaults to `;` — the CNES export delimiter. */
  delimiter?: string;
  /**
   * Any WHATWG encoding label. Defaults to `iso-8859-1`.
   *
   * Typed as `string` rather than Bun's `Encoding` union deliberately: that union
   * omits `latin1`, `iso-8859-1` and `windows-1252`, all of which its runtime
   * decodes correctly (verified against the real dump — see the accent test).
   * The cast at the construction site is that type-definition gap, not a claim
   * that any string works.
   */
  encoding?: string;
}

/**
 * Yields raw field arrays, header row included. Use {@link readCsvRecords} for
 * header-keyed access.
 */
export async function* streamCsvRows(
  filePath: string,
  options: CsvStreamOptions = {}
): AsyncGenerator<string[], void, undefined> {
  const delimiter = options.delimiter ?? ";";
  const decoder = new TextDecoder(
    (options.encoding ?? "iso-8859-1") as ConstructorParameters<typeof TextDecoder>[0]
  );

  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  /** Set when a `"` is seen inside quotes; the next char decides escape vs close. */
  let pendingQuote = false;
  let sawAnyChar = false;

  const stream = Bun.file(filePath).stream();

  for await (const chunk of stream) {
    // `stream: true` keeps multi-byte sequences intact across chunk boundaries.
    const text = decoder.decode(chunk, { stream: true });

    for (const char of text) {
      if (pendingQuote) {
        pendingQuote = false;
        if (char === '"') {
          // Doubled quote inside a quoted field — a literal `"`.
          field += '"';
          continue;
        }
        inQuotes = false;
        // Fall through so the delimiter/newline below is handled normally.
      }

      if (inQuotes) {
        if (char === '"') {
          pendingQuote = true;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        sawAnyChar = true;
        continue;
      }

      if (char === delimiter) {
        row.push(field);
        field = "";
        sawAnyChar = true;
        continue;
      }

      if (char === "\n") {
        row.push(field);
        // A trailing CR belongs to the line ending, not the last field.
        const last = row[row.length - 1];
        if (last !== undefined && last.endsWith("\r")) {
          row[row.length - 1] = last.slice(0, -1);
        }
        yield row;
        row = [];
        field = "";
        sawAnyChar = false;
        continue;
      }

      field += char;
      sawAnyChar = true;
    }
  }

  // Flush a final row that ended without a newline.
  if (field.length > 0 || row.length > 0 || sawAnyChar) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    yield row;
  }
}

export type CsvRecord = Record<string, string>;

/**
 * Yields header-keyed records, skipping the header row itself.
 *
 * Short rows are padded rather than dropped: a truncated trailing field is
 * common in the dump and losing the whole row over it would silently shrink the
 * import. Rows longer than the header keep only the mapped columns.
 */
export async function* readCsvRecords(
  filePath: string,
  options: CsvStreamOptions = {}
): AsyncGenerator<CsvRecord, void, undefined> {
  let header: string[] | null = null;

  for await (const row of streamCsvRows(filePath, options)) {
    if (header === null) {
      header = row.map((h) => h.trim());
      continue;
    }
    // Trailing blank line at EOF.
    if (row.length === 1 && row[0] === "") continue;

    const record: CsvRecord = {};
    for (let i = 0; i < header.length; i += 1) {
      record[header[i]!] = row[i] ?? "";
    }
    yield record;
  }
}

/** Reads only the header row. Used by the post-extract preflight check. */
export async function readCsvHeader(
  filePath: string,
  options: CsvStreamOptions = {}
): Promise<string[]> {
  for await (const row of streamCsvRows(filePath, options)) {
    return row.map((h) => h.trim());
  }
  return [];
}
