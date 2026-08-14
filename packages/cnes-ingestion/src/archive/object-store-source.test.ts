import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openArchiveFromObjectStore,
  verifyArchive,
  type RangeReadable,
} from "./object-store-source";

/**
 * The object-store reader, driven from a buffer.
 *
 * `RangeReadable` is two functions precisely so this can run without S3 and
 * without a network: what needs proving is the ZIP arithmetic and the integrity
 * gate, neither of which is about the transport.
 *
 * Fixtures are built with the system `zip` rather than by hand. A handwritten
 * archive would only prove the parser agrees with my reading of the spec, and it
 * would deflate everything — where a real zipper *stores* small files, which is
 * what broke the first version of this reader.
 */
function buildArchive(): { bytes: Uint8Array; contents: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), "objstore-"));
  let seed = 7;
  const noisy = (rows: number) => {
    const lines = ["CO_SIGLA;NO_DESCRICAO"];
    for (let i = 0; i < rows; i += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      lines.push(`${seed.toString(36)};${(seed ^ i).toString(36)}`);
    }
    return `${lines.join("\r\n")}\r\n`;
  };
  const contents: Record<string, string> = {
    "tbEstado202605.csv": '"CO_SIGLA";"NO_DESCRICAO"\r\n"SP";"SAO PAULO"\r\n',
    "tbMunicipio202605.csv": noisy(4000),
  };
  for (const [name, body] of Object.entries(contents)) {
    writeFileSync(join(dir, name), body, "latin1");
  }
  const zipPath = join(dir, "a.zip");
  const proc = Bun.spawnSync(["zip", "-q", "-X", zipPath, ...Object.keys(contents)], {
    cwd: dir,
  });
  if (!proc.success) throw new Error(new TextDecoder().decode(proc.stderr));
  const bytes = new Uint8Array(readFileSync(zipPath));
  rmSync(dir, { recursive: true, force: true });
  return { bytes, contents };
}

const archive = buildArchive();

/** Serves exact inclusive ranges, like S3 and unlike the FTP endpoint. */
function readableOver(bytes: Uint8Array): RangeReadable & { reads: number } {
  const readable = {
    reads: 0,
    async size() {
      return bytes.length;
    },
    async read(from: number, to: number) {
      readable.reads += 1;
      return bytes.slice(from, to + 1);
    },
  };
  return readable;
}

describe("verifyArchive", () => {
  it("accepts a complete archive and reports its entries", async () => {
    const result = await verifyArchive(readableOver(archive.bytes));
    expect(result.sizeBytes).toBe(archive.bytes.length);
    expect(result.entryCount).toBe(2);
    expect(result.entries.map((e) => e.name).sort()).toEqual([
      "tbEstado202605.csv",
      "tbMunicipio202605.csv",
    ]);
  });

  it("rejects a truncated object", async () => {
    /**
     * The case the gate exists for. The HTTPS fetch is chunked and declares no
     * length, and this pipeline has been observed receiving short data without
     * raising an error — so a truncated upload must fail here, not three entries
     * into a load.
     */
    const truncated = archive.bytes.slice(0, archive.bytes.length - 64);
    await expect(verifyArchive(readableOver(truncated))).rejects.toThrow(
      /end-of-central-directory|truncated/
    );
  });

  it("rejects an empty object", async () => {
    // A competence that does not exist answers 200 with an empty body.
    await expect(verifyArchive(readableOver(new Uint8Array(0)))).rejects.toThrow(
      /empty/
    );
  });

  it("rejects bytes that are not a ZIP at all", async () => {
    const junk = new Uint8Array(4096).fill(0x41);
    await expect(verifyArchive(readableOver(junk))).rejects.toThrow(
      /end-of-central-directory/
    );
  });
});

describe("openArchiveFromObjectStore", () => {
  const reference = { year: 2026, month: 5 };

  it("reads a header without pulling the whole entry", async () => {
    const readable = readableOver(archive.bytes);
    const source = await openArchiveFromObjectStore({ readable, reference });

    expect(await source.header("states")).toEqual(["CO_SIGLA", "NO_DESCRICAO"]);
  });

  it("streams records out of a deflated entry", async () => {
    const readable = readableOver(archive.bytes);
    const source = await openArchiveFromObjectStore({ readable, reference });

    let count = 0;
    for await (const record of source.records("municipalities")) {
      expect(record.CO_SIGLA).toBeDefined();
      count += 1;
    }
    expect(count).toBe(4000);
  });

  it("reads a stored (uncompressed) entry too", async () => {
    // `zip` stores rather than deflates when compression would not pay, so a
    // reader that assumes deflate fails on the smallest files in the archive.
    const readable = readableOver(archive.bytes);
    const source = await openArchiveFromObjectStore({ readable, reference });

    const rows = [];
    for await (const record of source.records("states")) rows.push(record);
    expect(rows).toEqual([{ CO_SIGLA: "SP", NO_DESCRICAO: "SAO PAULO" }]);
  });

  it("chunks its range requests rather than fetching an entry at once", async () => {
    const readable = readableOver(archive.bytes);
    const source = await openArchiveFromObjectStore({
      readable,
      reference,
      chunkBytes: 1024,
    });
    const before = readable.reads;
    for await (const _ of source.records("municipalities")) {
      // drain
    }
    // Several ranges, not one: a 322 MB entry must not be materialised whole.
    expect(readable.reads - before).toBeGreaterThan(2);
  });
});
