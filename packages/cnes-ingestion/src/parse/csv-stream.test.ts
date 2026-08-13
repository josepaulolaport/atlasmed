import { describe, expect, it, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCsvHeader, readCsvRecords, streamCsvRows } from "./csv-stream";

const dir = mkdtempSync(join(tmpdir(), "cnes-csv-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Writes latin-1 bytes, matching the real dump's encoding. */
function writeLatin1(name: string, text: string): string {
  const path = join(dir, name);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  writeFileSync(path, bytes);
  return path;
}

describe("streamCsvRows", () => {
  it("parses quoted, semicolon-delimited CRLF rows", async () => {
    const path = writeLatin1(
      "basic.csv",
      '"A";"B";"C"\r\n"1";"2";"3"\r\n"4";"5";"6"\r\n'
    );
    const rows = await Array.fromAsync(streamCsvRows(path));
    expect(rows).toEqual([
      ["A", "B", "C"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("keeps delimiters and newlines that sit inside quoted fields", async () => {
    const path = writeLatin1("embedded.csv", '"A";"B"\r\n"x;y";"line1\nline2"\r\n');
    const rows = await Array.fromAsync(streamCsvRows(path));
    expect(rows[1]).toEqual(["x;y", "line1\nline2"]);
  });

  it("unescapes doubled quotes", async () => {
    const path = writeLatin1("quotes.csv", '"A"\r\n"say ""hi"""\r\n');
    const rows = await Array.fromAsync(streamCsvRows(path));
    expect(rows[1]).toEqual(['say "hi"']);
  });

  it("decodes latin-1 accents rather than throwing on them", async () => {
    // UTF-8 decoding of these bytes yields replacement chars; latin-1 is correct.
    const path = writeLatin1("accents.csv", '"NO_PROFISSIONAL"\r\n"JOSÉ ANTÔNIO MÜLLER"\r\n');
    const rows = await Array.fromAsync(streamCsvRows(path));
    expect(rows[1]).toEqual(["JOSÉ ANTÔNIO MÜLLER"]);
  });

  it("emits a final row that has no trailing newline", async () => {
    const path = writeLatin1("noeol.csv", '"A";"B"\r\n"1";"2"');
    const rows = await Array.fromAsync(streamCsvRows(path));
    expect(rows[1]).toEqual(["1", "2"]);
  });

  it("preserves empty fields instead of collapsing them", async () => {
    const path = writeLatin1("empties.csv", '"A";"B";"C"\r\n"1";"";"3"\r\n');
    const rows = await Array.fromAsync(streamCsvRows(path));
    expect(rows[1]).toEqual(["1", "", "3"]);
  });
});

describe("readCsvRecords", () => {
  it("keys fields by header and skips the header row", async () => {
    const path = writeLatin1(
      "records.csv",
      '"CO_CNES";"NO_FANTASIA"\r\n"2077485";"CLINICA X"\r\n'
    );
    const records = await Array.fromAsync(readCsvRecords(path));
    expect(records).toEqual([{ CO_CNES: "2077485", NO_FANTASIA: "CLINICA X" }]);
  });

  it("pads a short row rather than dropping it", async () => {
    const path = writeLatin1("short.csv", '"A";"B";"C"\r\n"1";"2"\r\n');
    const records = await Array.fromAsync(readCsvRecords(path));
    expect(records).toEqual([{ A: "1", B: "2", C: "" }]);
  });

  it("ignores a trailing blank line", async () => {
    const path = writeLatin1("trailing.csv", '"A"\r\n"1"\r\n\r\n');
    const records = await Array.fromAsync(readCsvRecords(path));
    expect(records).toEqual([{ A: "1" }]);
  });
});

describe("readCsvHeader", () => {
  it("returns only the header row", async () => {
    const path = writeLatin1("header.csv", '"CO_CNES";"TP_UNIDADE"\r\n"1";"36"\r\n');
    expect(await readCsvHeader(path)).toEqual(["CO_CNES", "TP_UNIDADE"]);
  });
});
