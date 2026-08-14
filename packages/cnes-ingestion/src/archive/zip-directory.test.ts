import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  dataOffsetFromLocalHeader,
  LOCAL_HEADER_PREFIX_BYTES,
  METHOD_DEFLATE,
  METHOD_STORED,
  parseCentralDirectory,
  readEndOfCentralDirectory,
} from "./zip-directory";

/**
 * Built with the system `zip`, not by hand.
 *
 * A handwritten fixture would only prove the parser agrees with my reading of
 * the spec. The real archive is produced by a real zipper, and the details that
 * bite — data-descriptor flags, extra fields whose length differs between the
 * local and central records — are exactly the ones a handwritten fixture would
 * get conveniently right.
 */
function buildArchive(): { bytes: Uint8Array; contents: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), "zip-fixture-"));
  const contents: Record<string, string> = {
    "alpha.csv": "A;B\r\n1;2\r\n",
    // Long and repetitive so deflate actually compresses it.
    "beta.csv": `H1;H2\r\n${"row;value\r\n".repeat(500)}`,
    "gamma.csv": "only;one\r\n",
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

describe("zip central directory", () => {
  it("locates the directory from a tail slice", () => {
    const tail = archive.bytes.subarray(archive.bytes.length - 512);
    const location = readEndOfCentralDirectory(tail);
    expect(location).not.toBeNull();
    expect(location!.entryCount).toBe(3);
  });

  it("returns null when the tail is too short to contain the record", () => {
    expect(readEndOfCentralDirectory(archive.bytes.subarray(-8))).toBeNull();
  });

  it("parses every entry with its offset and sizes", () => {
    const location = readEndOfCentralDirectory(
      archive.bytes.subarray(archive.bytes.length - 512)
    )!;
    const entries = parseCentralDirectory({
      bytes: archive.bytes,
      bytesStartAt: 0,
      location,
    });
    expect(entries.map((e) => e.name)).toEqual(["alpha.csv", "beta.csv", "gamma.csv"]);
    const beta = entries[1]!;
    expect(beta.uncompressedSize).toBe(archive.contents["beta.csv"]!.length);
    expect(beta.compressedSize).toBeLessThan(beta.uncompressedSize);
    expect(beta.method).toBe(METHOD_DEFLATE);
    // `zip` stores rather than deflates when compression would not pay, so a
    // reader that assumes deflate throws "invalid stored block lengths" on the
    // smallest files in the archive.
    expect(entries[0]!.method).toBe(METHOD_STORED);
  });

  it("refuses a slice that does not cover the directory", () => {
    const location = readEndOfCentralDirectory(
      archive.bytes.subarray(archive.bytes.length - 512)
    )!;
    expect(() =>
      parseCentralDirectory({
        bytes: archive.bytes.subarray(archive.bytes.length - 16),
        bytesStartAt: archive.bytes.length - 16,
        location,
      })
    ).toThrow(/not inside the fetched slice/);
  });

  it("resolves the data offset through the local header, and inflates there", async () => {
    const location = readEndOfCentralDirectory(
      archive.bytes.subarray(archive.bytes.length - 512)
    )!;
    const entries = parseCentralDirectory({
      bytes: archive.bytes,
      bytesStartAt: 0,
      location,
    });

    for (const entry of entries) {
      const localHeader = archive.bytes.subarray(
        entry.localHeaderOffset,
        entry.localHeaderOffset + LOCAL_HEADER_PREFIX_BYTES
      );
      const dataAt = dataOffsetFromLocalHeader({ entry, localHeader });
      const stored = new Uint8Array(
        archive.bytes.subarray(dataAt, dataAt + entry.compressedSize)
      );
      const raw = entry.method === METHOD_STORED ? stored : Bun.inflateSync(stored);
      const decoder = new TextDecoder(
        "iso-8859-1" as ConstructorParameters<typeof TextDecoder>[0]
      );
      expect(decoder.decode(raw)).toBe(archive.contents[entry.name]!);
    }
  });
});
