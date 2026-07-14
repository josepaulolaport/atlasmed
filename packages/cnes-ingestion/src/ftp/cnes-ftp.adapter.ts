import { Client } from "basic-ftp";
import type { CnesFtpPort, CnesReference, FtpFileEntry } from "./cnes-ftp.port";
import {
  monthlyZipFileName,
  pickLatestReferenceFromZipNames,
} from "./cnes-ftp.utils";

export class CnesFtpAdapter implements CnesFtpPort {
  constructor(
    private readonly config: {
      host: string;
      user?: string;
      password?: string;
      basePath?: string;
      secure?: boolean;
    }
  ) {}

  private async withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client(30_000);
    client.ftp.verbose = false;

    try {
      await client.access({
        host: this.config.host,
        user: this.config.user ?? "anonymous",
        password: this.config.password ?? "guest",
        secure: this.config.secure ?? false,
      });

      return await fn(client);
    } finally {
      client.close();
    }
  }

  private basePath(): string {
    return (this.config.basePath ?? "/cnes").replace(/\/$/, "");
  }

  async discoverLatest(): Promise<CnesReference> {
    return this.withClient(async (client) => {
      const entries = await client.list(this.basePath());
      const latest = pickLatestReferenceFromZipNames(entries.map((entry) => entry.name));
      if (!latest) {
        throw new Error(`No CNES monthly ZIP archives found under ${this.basePath()}`);
      }

      return latest;
    });
  }

  async listFiles(reference: CnesReference): Promise<FtpFileEntry[]> {
    const zipName = monthlyZipFileName(reference);
    const path = `${this.basePath()}/${zipName}`;

    return this.withClient(async (client) => {
      const entries = await client.list(this.basePath());
      const entry = entries.find((item) => item.name.toUpperCase() === zipName.toUpperCase());
      if (!entry) {
        throw new Error(`CNES archive not found on FTP: ${path}`);
      }

      return [
        {
          path,
          name: entry.name,
          size: entry.size,
        },
      ];
    });
  }

  async downloadFile(entry: FtpFileEntry, destinationPath: string): Promise<void> {
    await this.withClient(async (client) => {
      await client.downloadTo(destinationPath, entry.path);
    });
  }
}
