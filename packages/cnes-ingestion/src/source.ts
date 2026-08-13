import { join } from "node:path";
import { readCsvHeader, readCsvRecords, type CsvRecord } from "./parse/csv-stream";
import { sourceFileName, type CnesReference, type CnesSourceName } from "./cnes-files";

/**
 * Where the loader gets its CSVs.
 *
 * Two implementations exist and they differ in more than plumbing: a directory
 * has every file available at once and costs nothing to re-read, while the
 * archive fetches each entry over the network and re-reading one means fetching
 * it again. The loader is written to read each file exactly once so both are
 * viable — the interface is the place that contract is stated.
 */
export interface CnesSource {
  /** For logs and error messages. */
  readonly describe: string;
  header(name: CnesSourceName): Promise<string[]>;
  records(name: CnesSourceName): AsyncIterable<CsvRecord>;
}

/** Extracted `tb*.csv` files on disk. Used by the smoke script and the tests. */
export function directoryCnesSource(input: {
  csvDir: string;
  reference: CnesReference;
}): CnesSource {
  const path = (name: CnesSourceName) =>
    join(input.csvDir, sourceFileName(name, input.reference));
  return {
    describe: `directory ${input.csvDir}`,
    header: (name) => readCsvHeader(path(name)),
    records: (name) => readCsvRecords(path(name)),
  };
}
