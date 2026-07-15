/**
 * TECHNICAL DEBT (v1): Staging load delegates to Python `import_modular.py`.
 * Replace with TS streaming loaders in `packages/cnes-ingestion` and golden parity tests.
 */

import { cnesVersionSuffix } from '@atlasmed/cnes-ingestion'
import { environment } from '@atlasmed/config'
import { loadWorkerConfig } from '../config'
import { truncateRegistryStaging } from '../infrastructure/registry-schemas'
import { updateIngestionRunPhase } from './discover-download.activities'

export async function loadRegistryStagingViaPythonActivity(input: {
  ingestionRunId: string
  ano: number
  mes: number
  extractPath: string
}): Promise<{ tablesLoaded: string; exitCode: number }> {
  await updateIngestionRunPhase(input.ingestionRunId, 'LOADING')

  const config = loadWorkerConfig()
  if (!config.importScript) {
    throw new Error(
      'CNES_IMPORT_SCRIPT is required when CNES_LOAD_MODE=ftp (default sibling cnes_mapping path not found)'
    )
  }

  const scriptFile = Bun.file(config.importScript)
  if (!(await scriptFile.exists())) {
    throw new Error(`CNES import script not found: ${config.importScript}`)
  }

  await truncateRegistryStaging()

  const version = cnesVersionSuffix({ ano: input.ano, mes: input.mes })
  const args = [
    config.importScript,
    '--csv-dir',
    input.extractPath,
    '--db-url',
    environment.DATABASE_URL,
    '--schema',
    'registry_staging',
    '--cnes-version',
    version,
    '--table',
    'all',
    '--force'
  ]

  const processHandle = Bun.spawn([config.pythonBin, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited
  ])

  if (exitCode !== 0) {
    throw new Error(
      `CNES Python staging load failed (exit ${exitCode}): ${stderr.slice(-2000) || stdout.slice(-2000)}`
    )
  }

  return { tablesLoaded: 'all', exitCode }
}
