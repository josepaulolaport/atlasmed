/** Build a lowercase territory identifier from a display name. */
export function slugifyTerritoryIdentifier(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isIsoCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value.trim().toUpperCase());
}

export function formatCountryCode(value: string): string {
  return value.trim().toUpperCase().slice(0, 2);
}
