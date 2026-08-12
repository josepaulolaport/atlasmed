import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skipLocalHeader } from "./archive-source";
import {
  dataOffsetFromLocalHeader,
  LOCAL_HEADER_PREFIX_BYTES,
  METHOD_STORED,
  parseCentralDirectory,
  readEndOfCentralDirectory,
  type ZipEntry,
} from "./zip-directory";

/**
 * `skipLocalHeader` reads an entry's payload out of a transfer that starts at
 * its local header, because fetching the header separately doubles the
 * connection count against an origin that rate-limits per IP.
 *
 * It is byte arithmetic over a chunked stream, and getting it wrong does not
 * throw — it feeds inflate a stream that is off by a few bytes. So it is tested
 * against a real archive, and at chunk sizes chosen to land inside the header,
 * on its boundary, and one byte at a time.
 */
function buildArchive(): { bytes: Uint8Array; contents: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), "skip-header-"));
  const contents: Record<string, string> = {
    "small.csv": "A;B\r\n1;2\r\n",
    "big.csv": `H1;H2\r\n${"row;value\r\n".repeat(800)}`,
  };
  for (const [name, body] of Object.entries(contents)) {
    writeFileSync(join(dir, name), body, "latin1");
  }
  const zipPath = join(dir, "fixture.zip");
  const proc = Bun.spawnSync(["zip", "-q", "-X", zipPath, ...Object.keys(contents)], {
    cwd: dir,
  });
  if (!proc.success) throw new Error(new TextDecoder().decode(proc.stderr));
  const bytes = new Uint8Array(readFileSync(zipPath));
  rmSync(dir, { recursive: true, force: true });
  return { bytes, contents };
}

const archive = buildArchive();
const entries = parseCentralDirectory({
  bytes: archive.bytes,
  bytesStartAt: 0,
  location: readEndOfCentralDirectory(
    archive.bytes.subarray(archive.bytes.length - 512)
  )!,
});

/** The transfer the entry reader asks for: from the local header, over-long. */
async function* transferFrom(
  entry: ZipEntry,
  chunkSize: number
): AsyncGenerator<Uint8Array> {
  const from = entry.localHeaderOffset;
  const to = Math.min(archive.bytes.length, from + 30 + 65535 + entry.compressedSize);
  for (let at = from; at < to; at += chunkSize) {
    yield archive.bytes.subarray(at, Math.min(to, at + chunkSize));
  }
}

async function collect(source: AsyncGenerator<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of source) chunks.push(chunk);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

describe("skipLocalHeader", () => {
  for (const chunkSize of [1, 7, 30, 31, 4096]) {
    it(`yields exactly the payload at ${chunkSize}-byte chunks`, async () => {
      for (const entry of entries) {
        const payload = await collect(
          skipLocalHeader(transferFrom(entry, chunkSize), entry)
        );
        expect(payload.length).toBe(entry.compressedSize);

        const decoded =
          entry.method === METHOD_STORED
            ? payload
            : Bun.inflateSync(new Uint8Array(payload));
        const text = new TextDecoder(
          "iso-8859-1" as ConstructorParameters<typeof TextDecoder>[0]
        ).decode(decoded);
        expect(text).toBe(archive.contents[entry.name]!);
      }
    });
  }

  it("throws rather than yielding a truncated payload", async () => {
    const entry = [...entries].sort(
      (a, b) => b.compressedSize - a.compressedSize
    )[0]!;

    // Measured, not guessed: the prefix length depends on the extra field, and
    // an over-long guess leaves the payload complete and the test vacuous.
    const dataAt = dataOffsetFromLocalHeader({
      entry,
      localHeader: archive.bytes.subarray(
        entry.localHeaderOffset,
        entry.localHeaderOffset + LOCAL_HEADER_PREFIX_BYTES
      ),
    });

    async function* truncated(): AsyncGenerator<Uint8Array> {
      yield archive.bytes.subarray(
        entry.localHeaderOffset,
        dataAt + entry.compressedSize - 5
      );
    }

    // Silently short data is the dangerous case: inflate would either fail
    // confusingly or, for a stored entry, produce a quietly clipped file.
    await expect(collect(skipLocalHeader(truncated(), entry))).rejects.toThrow(
      /short read/
    );
  });
});
