import { normalizeSearchFilterValue } from "../../../shared/normalize-search-filter";

/** Split comma-joined specialty labels into normalized Meili/SQL filter values. */
export function parseSpecialtyFilterValues(specialty?: string): string[] {
  if (!specialty?.trim()) return [];
  const values = specialty
    .split(",")
    .map((part) => normalizeSearchFilterValue(part.trim()))
    .filter((part) => part.length > 0);
  return [...new Set(values)];
}
