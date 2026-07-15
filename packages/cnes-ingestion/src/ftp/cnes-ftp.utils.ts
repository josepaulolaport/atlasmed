import type { CnesReference } from './cnes-ftp.port'

export const CNES_MONTHLY_ZIP_PATTERN = /^BASE_DE_DADOS_CNES_(\d{4})(\d{2})\.ZIP$/i

export function cnesVersionSuffix(reference: CnesReference): string {
  return `${reference.ano}${String(reference.mes).padStart(2, '0')}`
}

export function monthlyZipFileName(reference: CnesReference): string {
  return `BASE_DE_DADOS_CNES_${cnesVersionSuffix(reference)}.ZIP`
}

export function parseReferenceFromZipFileName(name: string): CnesReference | null {
  const match = CNES_MONTHLY_ZIP_PATTERN.exec(name)
  if (!match) {
    return null
  }

  return {
    ano: Number(match[1]),
    mes: Number(match[2])
  }
}

export function archiveKeyForReference(reference: CnesReference): string {
  const version = cnesVersionSuffix(reference)
  return `cnes/${version}/${monthlyZipFileName(reference)}`
}

export function compareReferences(left: CnesReference, right: CnesReference): number {
  if (left.ano !== right.ano) {
    return left.ano - right.ano
  }
  return left.mes - right.mes
}

export function pickLatestReferenceFromZipNames(names: string[]): CnesReference | null {
  const references = names
    .map((name) => parseReferenceFromZipFileName(name))
    .filter((value): value is CnesReference => value !== null)
    .sort((left, right) => compareReferences(right, left))

  return references[0] ?? null
}

export function previousReference(reference: CnesReference): CnesReference | null {
  if (reference.mes > 1) {
    return { ano: reference.ano, mes: reference.mes - 1 }
  }

  return { ano: reference.ano - 1, mes: 12 }
}
