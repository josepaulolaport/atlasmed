import { describe, expect, test } from 'bun:test'
import {
  archiveKeyForReference,
  compareReferences,
  parseReferenceFromZipFileName,
  pickLatestReferenceFromZipNames
} from './cnes-ftp.utils'

describe('cnes FTP utilities', () => {
  test('parses monthly ZIP reference names', () => {
    expect(parseReferenceFromZipFileName('BASE_DE_DADOS_CNES_202605.ZIP')).toEqual({
      ano: 2026,
      mes: 5
    })
    expect(parseReferenceFromZipFileName('base_de_dados_cnes_202606.zip')).toEqual({
      ano: 2026,
      mes: 6
    })
    expect(parseReferenceFromZipFileName('tbEstado202605.csv')).toBeNull()
  })

  test('selects latest reference by YYYYMM', () => {
    const references = [
      { ano: 2026, mes: 4 },
      { ano: 2026, mes: 6 },
      { ano: 2025, mes: 12 }
    ].sort((left, right) => compareReferences(right, left))

    expect(references[0]).toEqual({ ano: 2026, mes: 6 })
  })

  test('builds archive key for monthly ZIP', () => {
    expect(archiveKeyForReference({ ano: 2026, mes: 5 })).toBe(
      'cnes/202605/BASE_DE_DADOS_CNES_202605.ZIP'
    )
  })

  test('picks latest ZIP from FTP listing fixture', () => {
    const latest = pickLatestReferenceFromZipNames([
      'BASE_DE_DADOS_CNES_202604.ZIP',
      'BASE_DE_DADOS_CNES_202606.ZIP',
      'readme.txt'
    ])

    expect(latest).toEqual({ ano: 2026, mes: 6 })
  })
})
