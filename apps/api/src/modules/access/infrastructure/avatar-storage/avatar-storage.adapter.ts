import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { environment } from "../../../../app/config/environment";
import { storageService } from "../../../../infrastructure/storage/storage.service";
import type { AvatarStoragePort } from "../../application/use-cases/update-avatar.use-case";

function localAvatarPath(key: string): string {
  const root = resolve(environment.AVATAR_STORAGE_LOCAL_PATH);
  const path = resolve(root, key);
  if (!path.startsWith(`${root}/`)) throw new Error("Invalid avatar storage key");
  return path;
}

export class AvatarStorageAdapter implements AvatarStoragePort {
  async upload(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    if (storageService.isConfigured()) {
      await storageService.upload(key, bytes, contentType);
      return;
    }

    if (environment.NODE_ENV === "production") {
      throw new Error("Object storage must be configured for avatar uploads in production");
    }

    const path = localAvatarPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async delete(key: string): Promise<void> {
    if (storageService.isConfigured()) {
      await storageService.delete(key);
      return;
    }

    if (environment.NODE_ENV === "production") return;
    await rm(localAvatarPath(key), { force: true });
  }

  async download(key: string): Promise<Uint8Array> {
    if (storageService.isConfigured()) return storageService.download(key);
    if (environment.NODE_ENV === "production") throw new Error("Object storage is not configured");
    return new Uint8Array(await readFile(localAvatarPath(key)));
  }
}
