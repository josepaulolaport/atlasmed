const TERRITORY_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;

export function normalizeTerritorySlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function validateTerritorySlug(slug: string): boolean {
  return TERRITORY_SLUG_PATTERN.test(slug);
}
