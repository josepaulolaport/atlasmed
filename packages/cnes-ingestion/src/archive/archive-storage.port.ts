import type { CnesReference } from '../ftp/cnes-ftp.port'

export interface ArchiveFileEntry {
  key: string
  path: string
  checksum: string
  size: number
}

export interface ArchiveManifest {
  reference: CnesReference
  files: ArchiveFileEntry[]
  createdAt: string
}

export interface ArchiveStoragePort {
  saveManifest(manifest: ArchiveManifest): Promise<void>
  getManifest(reference: CnesReference): Promise<ArchiveManifest | null>
  resolvePath(key: string): string
  writeFile(key: string, content: Uint8Array | string): Promise<void>
  readFile(key: string): Promise<Uint8Array>
  deleteFile(key: string): Promise<void>
}
