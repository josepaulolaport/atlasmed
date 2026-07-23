/** Portuguese / Romance name particles ignored for identity matching. */
const NAME_PARTICLES = new Set([
  "de",
  "da",
  "do",
  "dos",
  "das",
  "e",
  "di",
  "du",
  "del",
  "della",
  "van",
  "von",
]);

/**
 * Normalize a person name into comparable tokens (case/accent-insensitive).
 * Drops particles and 1-char fragments.
 */
export function tokenizePersonName(name: string): string[] {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !NAME_PARTICLES.has(token));
}

function tokenMatches(expected: string, provided: string): boolean {
  return (
    expected === provided ||
    (expected.length >= 3 && provided.includes(expected)) ||
    (provided.length >= 3 && expected.includes(provided))
  );
}

/**
 * Soft identity check: at least half of the expected name tokens (min 1)
 * must appear in the provided full name. Allows extra / fewer middle names.
 */
export function namesFuzzyMatch(expectedFullName: string, providedFullName: string): boolean {
  const expected = tokenizePersonName(expectedFullName);
  const provided = tokenizePersonName(providedFullName);

  if (expected.length === 0) return true;
  if (provided.length === 0) return false;

  const matched = expected.filter((exp) =>
    provided.some((prov) => tokenMatches(exp, prov)),
  ).length;

  const required = Math.max(1, Math.ceil(expected.length * 0.5));
  return matched >= required;
}

/** Calendar date as `YYYY-MM-DD` (UTC) for birth-date comparisons. */
export function toDateOnlyString(value: Date | string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return trimmed.slice(0, 10);
    }
    return parsed.toISOString().slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function birthDatesMatch(
  expected: Date | string | null | undefined,
  provided: string | null | undefined,
): boolean {
  if (expected == null) return true;
  if (!provided) return false;
  return toDateOnlyString(expected) === toDateOnlyString(provided);
}
