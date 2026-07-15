import { basename } from 'node:path'
import { tablesForCnesFile } from '../ftp/cnes-file-mapping'

export interface ParsedCnesChunk {
  table: string
  rowCount: number
}

function countDataRows(content: string): number {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length <= 1) {
    return 0
  }

  return lines.length - 1
}

export async function parseCnesFile(input: {
  filePath: string
  referenceAno: number
  referenceMes: number
}): Promise<ParsedCnesChunk[]> {
  void input.referenceAno
  void input.referenceMes

  const fileName = basename(input.filePath)
  const tables = tablesForCnesFile(fileName)
  if (tables.length === 0) {
    return []
  }

  const file = Bun.file(input.filePath)
  if (!(await file.exists())) {
    return tables.map((table) => ({ table, rowCount: 0 }))
  }

  const content = await file.text()
  const rowCount = countDataRows(content)
  return tables.map((table) => ({ table, rowCount }))
}
