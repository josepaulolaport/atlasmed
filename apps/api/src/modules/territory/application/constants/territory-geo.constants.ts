/** Same-level sibling overlap above this ratio is blocked (touching borders allowed). */
export const GEO_SIBLING_OVERLAP_BLOCK_RATIO = 0.05

export const DEFAULT_COUNTRY_CODE = 'BR'

export function normalizeCountryCode(code?: string | null): string {
  return (code?.trim().toUpperCase() || DEFAULT_COUNTRY_CODE).slice(0, 2)
}

export function validateCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code)
}
