import { afterAll, describe, expect, it } from "bun:test";
import { Client } from "basic-ftp";
import { Writable } from "node:stream";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFtpServer } from "./test-support/ftp-server";

/**
 * Can one login serve every entry?
 *
 * The reader opens a connection per entry because a bounded read has to abandon
 * its transfer — FTP's `REST` sets where a transfer starts and nothing sets
 * where it ends. Whether the client survives that and can issue another `RETR`
 * on the same control connection is a claim about basic-ftp, so it is measured
 * here rather than assumed.
 */
/**
 * Deliberately incompressible: a bounded read only proves anything if the file
 * is larger than the bound, and repetitive CSV deflates to a few hundred bytes.
 */
function noisyCsv(rows: number): string {
  let seed = 12345;
  const lines: string[] = ["A;B"];
  for (let i = 0; i < rows; i += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    lines.push(`${seed.toString(36)};${(seed ^ i).toString(36)}`);
  }
  return `${lines.join("\r\n")}\r\n`;
}

function buildArchive(): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), "reuse-"));
  writeFileSync(join(dir, "a.csv"), noisyCsv(20000), "latin1");
  writeFileSync(join(dir, "b.csv"), noisyCsv(20000), "latin1");
  const zipPath = join(dir, "f.zip");
  const proc = Bun.spawnSync(["zip", "-q", "-X", zipPath, "a.csv", "b.csv"], {
    cwd: dir,
  });
  if (!proc.success) throw new Error(new TextDecoder().decode(proc.stderr));
  const bytes = new Uint8Array(readFileSync(zipPath));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

const archive = buildArchive();
const server = await startFtpServer({ files: { "f.zip": archive } });
afterAll(() => server.close());

/** Reads `length` bytes from `offset`; `bounded` walks away mid-transfer. */
async function read(
  client: Client,
  offset: number,
  length: number | "toEnd"
): Promise<{ bytes: number; error: string | null }> {
  let total = 0;
  let error: string | null = null;
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      const take = length === "toEnd" ? chunk.length : Math.min(length - total, chunk.length);
      total += take;
      if (length !== "toEnd" && total >= length) this.destroy();
      callback();
    },
  });
  try {
    await client.downloadTo(sink, "f.zip", offset);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return { bytes: total, error };
}

async function connect(): Promise<Client> {
  const client = new Client(15_000);
  await client.access({
    host: "127.0.0.1",
    port: server.port,
    user: "anonymous",
    password: "anonymous@",
    secure: false,
  });
  return client;
}

describe("basic-ftp control connection across reads", () => {
  it("reuses one login across transfers that run to completion", async () => {
    const loginsBefore = server.logins;
    const client = await connect();
    try {
      const first = await read(client, 0, "toEnd");
      const second = await read(client, 0, "toEnd");
      expect(first.bytes).toBeGreaterThan(0);
      // Reuse works fine — so the limitation below is about abandonment
      // specifically, not about reusing a client at all.
      expect(second.bytes).toBe(first.bytes);
      expect(second.error).toBeNull();
    } finally {
      client.close();
    }
    expect(server.logins - loginsBefore).toBe(1);
  });

  it("cannot serve a second read after a transfer was abandoned", async () => {
    const client = await connect();
    try {
      const first = await read(client, 0, 1024);
      expect(first.bytes).toBeGreaterThanOrEqual(1024);

      const second = await read(client, 2048, 512);

      /**
       * This is why the reader opens one connection per entry.
       *
       * A bounded read has to abandon its transfer — `REST` sets where a
       * transfer starts and FTP has nothing that sets where it ends — and
       * basic-ftp does not resynchronise the control connection afterwards, so
       * the next `RETR` delivers nothing.
       *
       * If a future version fixes this, this expectation fails and the reader
       * can drop to a single login for the whole archive.
       */
      expect(second.bytes).toBe(0);
      // The first read did get its bytes, so the failure is specific to what
      // follows an abandoned transfer rather than to the client generally.
      expect(first.bytes).toBeGreaterThan(second.bytes);
    } finally {
      client.close();
    }
  });
});
