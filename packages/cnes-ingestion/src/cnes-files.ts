/**
 * CNES export file naming and the columns we read.
 *
 * Every file in the monthly dump is suffixed with its competence, e.g.
 * `tbEstabelecimento202605.csv`. Only the seven files below are read; the dump
 * ships ~90 more that this feature has no use for.
 */

export const CNES_REFERENCE_PATTERN = /^BASE_DE_DADOS_CNES_(\d{6})\.ZIP$/i;

/** A CNES competence — the year/month a dump describes. */
export interface CnesReference {
  year: number;
  month: number;
}

/** `202605` ⇄ `{ year: 2026, month: 5 }`. */
export function formatReference(reference: CnesReference): string {
  return `${reference.year}${String(reference.month).padStart(2, "0")}`;
}

export function parseReference(value: string): CnesReference | null {
  if (!/^\d{6}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function archiveFileName(reference: CnesReference): string {
  return `BASE_DE_DADOS_CNES_${formatReference(reference)}.ZIP`;
}

export function archiveObjectKey(reference: CnesReference): string {
  return `cnes/${formatReference(reference)}/${archiveFileName(reference)}`;
}

/** Logical name → file stem. Suffix the competence to get the real filename. */
export const CNES_SOURCE_STEMS = {
  establishments: "tbEstabelecimento",
  workload: "tbCargaHorariaSus",
  professionals: "tbDadosProfissionalSus",
  occupations: "tbAtividadeProfissional",
  states: "tbEstado",
  municipalities: "tbMunicipio",
} as const;

export type CnesSourceName = keyof typeof CNES_SOURCE_STEMS;

export function sourceFileName(
  source: CnesSourceName,
  reference: CnesReference
): string {
  return `${CNES_SOURCE_STEMS[source]}${formatReference(reference)}.csv`;
}

/**
 * Columns read per file. Kept explicit so a silently renamed CNES column fails
 * the preflight check instead of loading a table full of empty strings.
 */
export const REQUIRED_COLUMNS: Record<CnesSourceName, readonly string[]> = {
  establishments: ["CO_UNIDADE", "CO_CNES", "NO_RAZAO_SOCIAL", "NO_FANTASIA", "TP_UNIDADE"],
  workload: [
    "CO_UNIDADE",
    "CO_PROFISSIONAL_SUS",
    "CO_CBO",
    "CO_CONSELHO_CLASSE",
    "NU_REGISTRO",
    "SG_UF_CRM",
  ],
  professionals: ["CO_PROFISSIONAL_SUS", "NO_PROFISSIONAL", "CO_CNS", "CO_CPF"],
  occupations: ["CO_CBO", "DS_ATIVIDADE_PROFISSIONAL", "TP_CBO_SAUDE", "ST_CBO_REGULAMENTADO"],
  states: ["CO_SIGLA", "NO_DESCRICAO"],
  municipalities: ["CO_MUNICIPIO", "NO_MUNICIPIO", "CO_SIGLA_ESTADO"],
} as const;

/**
 * Órgão-emissor council codes — **not** `tbConselhoClasse`.
 *
 * The dump carries two disagreeing council code systems; `tbCargaHorariaSus`
 * uses órgão emissor, where CRM is `71`. On the 202605 dump, `71` accounts for
 * 99.56 % of the 1 758 035 rows with a CBO `225*` occupation, which is the only
 * cohort v1 imports.
 *
 * Codes absent from this map are **skipped, never guessed**: a registration
 * filed under an invented council is worse than a missing one, because it reads
 * as authoritative. The loader reports how many it skipped.
 */
export const CURATED_COUNCILS: readonly {
  cnesId: string;
  name: string;
  abbreviation: string;
}[] = [
  { cnesId: "71", name: "Conselho Regional de Medicina", abbreviation: "CRM" },
];
