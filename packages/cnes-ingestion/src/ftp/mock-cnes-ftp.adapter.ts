import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expectedCnesCsvFiles } from './cnes-file-mapping'
import type { CnesFtpPort, CnesReference, FtpFileEntry } from './cnes-ftp.port'
import { cnesVersionSuffix, monthlyZipFileName } from './cnes-ftp.utils'

async function createMockZipArchive(
  reference: CnesReference,
  destinationPath: string
): Promise<void> {
  const version = cnesVersionSuffix(reference)
  const stagingDir = join(tmpdir(), `cnes-mock-${version}-${Bun.randomUUIDv7()}`)
  const innerDir = join(stagingDir, `BASE_DE_DADOS_CNES_${version}`)

  await mkdir(innerDir, { recursive: true })

  for (const csvName of expectedCnesCsvFiles(version)) {
    await Bun.write(join(innerDir, csvName), `mock,header\n1,value\n`)
  }

  await mkdir(dirname(destinationPath), { recursive: true })

  const zipProcess = Bun.spawn(
    ['zip', '-r', '-q', destinationPath, `BASE_DE_DADOS_CNES_${version}`],
    { cwd: stagingDir, stdout: 'ignore', stderr: 'pipe' }
  )
  const exitCode = await zipProcess.exited

  if (exitCode !== 0) {
    const stderr = await new Response(zipProcess.stderr).text()
    throw new Error(`Failed to create mock CNES ZIP archive: ${stderr}`)
  }
}

export class MockCnesFtpAdapter implements CnesFtpPort {
  constructor(private readonly fixedReference?: CnesReference) {}

  async discoverLatest(): Promise<CnesReference> {
    if (this.fixedReference) {
      return this.fixedReference
    }

    const now = new Date()
    return {
      ano: now.getFullYear(),
      mes: now.getMonth() + 1
    }
  }

  async listFiles(reference: CnesReference): Promise<FtpFileEntry[]> {
    const name = monthlyZipFileName(reference)
    return [
      {
        path: `/cnes/${name}`,
        name,
        size: 4096
      }
    ]
  }

  async downloadFile(entry: FtpFileEntry, destinationPath: string): Promise<void> {
    const match = /BASE_DE_DADOS_CNES_(\d{4})(\d{2})\.ZIP/i.exec(entry.name)
    if (!match) {
      throw new Error(`Mock CNES FTP only supports monthly ZIP downloads: ${entry.name}`)
    }

    await createMockZipArchive({ ano: Number(match[1]), mes: Number(match[2]) }, destinationPath)
  }
}
