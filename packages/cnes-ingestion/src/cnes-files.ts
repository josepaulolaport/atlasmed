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
  establishments: [
    "CO_UNIDADE",
    "CO_CNES",
    "NO_RAZAO_SOCIAL",
    "NO_FANTASIA",
    "TP_UNIDADE",
    /**
     * The *managing* município — `tbEstabelecimento` carries no plain
     * `CO_MUNICIPIO`. For every clinic we operate the two coincide: measured
     * 1423 of 1423 against our own `facilities.municipality_id`, zero
     * divergences, zero blanks (202605). See the note on
     * `registry.facilities.municipality_cnes_id`.
     */
    "CO_MUNICIPIO_GESTOR",
  ],
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
 * Council codes are **curated in the database, not in code** (ADR 0009 §6).
 *
 * The dump carries two disagreeing council code systems — `tbConselhoClasse`
 * calls CRM `10`, while the órgão-emissor codes `tbCargaHorariaSus` actually
 * carries call it `71` — so seeding from the export mislabels every doctor's
 * council. `registry.professional_councils` is filled by hand once and the
 * loader only reads it; a code absent from it is skipped, never guessed, because
 * a registration filed under an invented council reads as authoritative.
 *
 * Seed for reference (`atlasmed_id` bridges to `person_professional_registration_councils`):
 *
 * ```sql
 * INSERT INTO registry.professional_councils (cnes_id, name, abbreviation, atlasmed_id)
 * VALUES ('71', 'Conselho Regional de Medicina', 'CRM', 10);
 * ```
 *
 * On the 202605 dump `71` accounts for 99.56 % of rows carrying a CBO `225*`.
 */
