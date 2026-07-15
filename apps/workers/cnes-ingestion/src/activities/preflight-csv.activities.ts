import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { cnesVersionSuffix, expectedCnesCsvFiles } from '@atlasmed/cnes-ingestion'
import { updateIngestionRunPhase } from './discover-download.activities'

export async function preflightExtractedCsvActivity(input: {
  ingestionRunId: string
  ano: number
  mes: number
  extractPath: string
}): Promise<{ expectedCsvCount: number; presentCsvCount: number; missingFiles: string[] }> {
  await updateIngestionRunPhase(input.ingestionRunId, 'PREFLIGHT')

  const version = cnesVersionSuffix({ ano: input.ano, mes: input.mes })
  const expectedFiles = expectedCnesCsvFiles(version)
  const missingFiles: string[] = []

  for (const fileName of expectedFiles) {
    try {
      await access(`${input.extractPath}/${fileName}`, constants.F_OK)
    } catch {
      missingFiles.push(fileName)
    }
  }

  const result = {
    expectedCsvCount: expectedFiles.length,
    presentCsvCount: expectedFiles.length - missingFiles.length,
    missingFiles
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `CNES preflight failed: missing ${missingFiles.length} expected CSV files (${missingFiles.slice(0, 5).join(', ')}${missingFiles.length > 5 ? ', ...' : ''})`
    )
  }

  return result
}
