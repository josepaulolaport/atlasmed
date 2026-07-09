export interface CnesReference {
  ano: number;
  mes: number;
}

export interface FtpFileEntry {
  path: string;
  name: string;
  size?: number;
}

export interface CnesFtpPort {
  discoverLatest(): Promise<CnesReference>;
  listFiles(reference: CnesReference): Promise<FtpFileEntry[]>;
  downloadFile(entry: FtpFileEntry, destinationPath: string): Promise<void>;
}
