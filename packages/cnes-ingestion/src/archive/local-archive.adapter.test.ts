import { describe, expect, test } from "bun:test";
import { LocalArchiveAdapter, MockCnesFtpAdapter, archiveKeyForReference, checksumContent } from "../index";

describe("cnes-ingestion package", () => {
  test("mock FTP lists monthly ZIP and local archive round-trips manifest", async () => {
    const ftp = new MockCnesFtpAdapter({ ano: 2026, mes: 6 });
    const reference = await ftp.discoverLatest();
    const files = await ftp.listFiles(reference);

    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe("BASE_DE_DADOS_CNES_202606.ZIP");

    const archive = new LocalArchiveAdapter("/tmp/atlasmed-cnes-archive-test");
    const key = archiveKeyForReference(reference);
    const tempPath = `/tmp/cnes-mock-download-${Bun.randomUUIDv7()}.zip`;
    await ftp.downloadFile(files[0]!, tempPath);
    const content = new Uint8Array(await Bun.file(tempPath).arrayBuffer());
    await archive.writeFile(key, content);

    const manifest = {
      reference,
      createdAt: new Date().toISOString(),
      files: files.map((file) => ({
        key,
        path: file.path,
        checksum: checksumContent(content),
        size: content.byteLength,
      })),
    };

    await archive.saveManifest(manifest);
    const loaded = await archive.getManifest(reference);

    expect(loaded?.reference).toEqual(reference);
    expect(loaded?.files).toHaveLength(1);
    await archive.deleteFile(key);
  });
});
