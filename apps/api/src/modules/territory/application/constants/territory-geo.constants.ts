/** Child area ratio inside parent required for automatic primary parent assignment. */
export const GEO_PARENT_AUTO_THRESHOLD = 0.9;

/** Minimum overlap ratio to create a secondary geo rollup link. */
export const GEO_ROLLUP_THRESHOLD = 0.1;

/** Top-two parent candidates within this margin → ambiguous. */
export const GEO_AMBIGUOUS_MARGIN = 0.1;

/** Same-level sibling overlap above this ratio is blocked (touching borders allowed). */
export const GEO_SIBLING_OVERLAP_BLOCK_RATIO = 0.05;

export const DEFAULT_COUNTRY_CODE = "BR";

export function normalizeCountryCode(code?: string | null): string {
  return (code?.trim().toUpperCase() || DEFAULT_COUNTRY_CODE).slice(0, 2);
}

export function validateCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}
