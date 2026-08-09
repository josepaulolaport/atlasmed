import { ValidationError } from "../errors/domain-errors";

/**
 * Parse a CRM entity id from an HTTP path or query parameter (always string on the wire).
 */
export function parseRouteId(value: string, label = "id"): number {
  const trimmed = value.trim();
  const parsed = Number.parseInt(trimmed, 10);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    String(parsed) !== trimmed
  ) {
    throw new ValidationError([
      {
        field: label,
        message: `Invalid ${label}`,
      },
    ]);
  }

  return parsed;
}

/** Serialize a CRM id for JWT claims, audit text columns, or grant resourceId. */
export function toCrmIdString(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ValidationError([
      {
        field: "id",
        message: "Invalid CRM id",
      },
    ]);
  }
  return String(id);
}
