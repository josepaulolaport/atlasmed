import occupations from "../data/cbo-occupations.json";

const cboByCode = occupations as Record<string, string>;

export function resolveOccupationName(
  code: string | null | undefined,
): string | null {
  if (!code) return null;

  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  return cboByCode[normalized] ?? null;
}

export function resolveOccupationCodes(
  codes: string | null | undefined,
): string | null {
  if (!codes) return null;

  const labels = codes
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((code) => resolveOccupationName(code) ?? code);

  return labels.length > 0 ? labels.join(", ") : null;
}
