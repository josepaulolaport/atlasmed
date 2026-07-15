import { describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { archiveKeyForReference, MockCnesFtpAdapter } from '@atlasmed/cnes-ingestion'
import { resolveCnesCsvDir } from './activities/extract-archive.activities'

describe('extractMonthlyArchiveActivity helpers', () => {
  test('resolves nested BASE_DE_DADOS_CNES folder when present', async () => {
    const reference = { ano: 2026, mes: 6 }
    const extractRoot = join(tmpdir(), `cnes-extract-test-${Bun.randomUUIDv7()}`)
    const nested = join(extractRoot, 'BASE_DE_DADOS_CNES_202606')
    await mkdir(nested, { recursive: true })

    const resolved = await resolveCnesCsvDir(extractRoot, reference)
    expect(resolved).toBe(nested)

    await rm(extractRoot, { recursive: true, force: true })
  })
})

describe('mock ZIP extract round-trip', () => {
  test('creates extractable ZIP with expected CSV stubs', async () => {
    const reference = { ano: 2026, mes: 6 }
    const ftp = new MockCnesFtpAdapter(reference)
    const files = await ftp.listFiles(reference)
    const zipPath = join(tmpdir(), `cnes-mock-${Bun.randomUUIDv7()}.zip`)
    const extractRoot = join(tmpdir(), `cnes-extract-${Bun.randomUUIDv7()}`)

    await ftp.downloadFile(files[0]!, zipPath)
    await mkdir(extractRoot, { recursive: true })

    const unzipProcess = Bun.spawn(['unzip', '-q', zipPath, '-d', extractRoot], {
      stderr: 'pipe',
      stdout: 'ignore'
    })
    const exitCode = await unzipProcess.exited
    expect(exitCode).toBe(0)

    const csvDir = await resolveCnesCsvDir(extractRoot, reference)
    const csvFile = Bun.file(join(csvDir, 'tbEstado202606.csv'))
    expect(await csvFile.exists()).toBe(true)

    await rm(zipPath, { force: true })
    await rm(extractRoot, { recursive: true, force: true })
  })

  test('archive key matches monthly ZIP layout', () => {
    expect(archiveKeyForReference({ ano: 2026, mes: 5 })).toBe(
      'cnes/202605/BASE_DE_DADOS_CNES_202605.ZIP'
    )
  })
})
