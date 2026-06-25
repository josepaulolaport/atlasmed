/**
 * IBGE macro-regions (Regiões Geográficas) used by br-atlas and official statistics.
 * @see https://github.com/carolinabigonha/br-atlas
 * @see https://servicodados.ibge.gov.br/api/docs/localidades
 */
export const BRAZIL_COUNTRY_CODE = "BR";

export const IBGE_REGIONS = [
  { id: 1, slug: "norte", name: "Norte", sigla: "N" },
  { id: 2, slug: "nordeste", name: "Nordeste", sigla: "NE" },
  { id: 3, slug: "sudeste", name: "Sudeste", sigla: "SE" },
  { id: 4, slug: "sul", name: "Sul", sigla: "S" },
  { id: 5, slug: "centro-oeste", name: "Centro-Oeste", sigla: "CO" },
] as const;

export const IBGE_MALHAS_BASE = "https://servicodados.ibge.gov.br/api/v3/malhas";
export const IBGE_LOCALIDADES_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";

export const BRAZIL_STATE_SIGLAS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export type BrazilStateSigla = (typeof BRAZIL_STATE_SIGLAS)[number];

export function regionSlugForIbgeRegionId(regionId: number): string {
  const region = IBGE_REGIONS.find((entry) => entry.id === regionId);
  if (!region) {
    throw new Error(`Unknown IBGE region id: ${regionId}`);
  }
  return region.slug;
}
