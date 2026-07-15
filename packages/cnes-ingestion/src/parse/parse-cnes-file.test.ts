import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseCnesFile } from '../parse/parse-cnes-file'

describe('parseCnesFile', () => {
  test('maps mock establishment file to facilities table chunks', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cnes-parse-'))
    const filePath = join(dir, 'tbEstabelecimento.csv')
    await writeFile(filePath, 'CO_CNES;NO_FANTASIA\n123;Clinic A\n456;Clinic B\n')

    const chunks = await parseCnesFile({
      filePath,
      referenceAno: 2026,
      referenceMes: 6
    })

    expect(chunks).toEqual([{ table: 'facilities', rowCount: 2 }])
  })
})
