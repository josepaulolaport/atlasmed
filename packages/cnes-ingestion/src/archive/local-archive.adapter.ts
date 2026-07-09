import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CnesReference } from "../ftp/cnes-ftp.port";
import type { ArchiveManifest, ArchiveStoragePort } from "./archive-storage.port";

function manifestKey(reference: CnesReference): string {
  return `${reference.ano}/${String(reference.mes).padStart(2, "0")}/manifest.json`;
}

export class LocalArchiveAdapter implements ArchiveStoragePort {
  constructor(private readonly basePath: string) {}

  resolvePath(key: string): string {
    return join(this.basePath, key);
  }

  async saveManifest(manifest: ArchiveManifest): Promise<void> {
    const key = manifestKey(manifest.reference);
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, JSON.stringify(manifest, null, 2));
  }

  async getManifest(reference: CnesReference): Promise<ArchiveManifest | null> {
    const path = this.resolvePath(manifestKey(reference));
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return null;
    }

    return (await file.json()) as ArchiveManifest;
  }

  async writeFile(key: string, content: Uint8Array | string): Promise<void> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, content);
  }

  async readFile(key: string): Promise<Uint8Array> {
    const path = this.resolvePath(key);
    return new Uint8Array(await Bun.file(path).arrayBuffer());
  }

  async deleteFile(key: string): Promise<void> {
    const path = this.resolvePath(key);
    await rm(path, { force: true });
  }
}

export function checksumContent(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}
