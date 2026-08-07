import { UnauthorizedError } from "../errors";

/**
 * Parse a JWT claim or HTTP param that encodes a CRM bigint PK as a decimal string.
 * Rejects non-positive integers and values that do not round-trip as the same string.
 */
export function parseCrmId(value: string, label = "id"): number {
  const trimmed = value.trim();
  const parsed = Number.parseInt(trimmed, 10);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    String(parsed) !== trimmed
  ) {
    throw new UnauthorizedError(`Invalid ${label}`);
  }

  return parsed;
}

/**
 * Parse an optional CRM id from query/header; returns null when absent.
 */
export function parseOptionalCrmId(
  value: string | null | undefined,
  label = "id"
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return parseCrmId(value, label);
}

/**
 * Soft-parse grant `resource_id` text (or similar) for HTTP DTOs.
 * Returns undefined when absent or not a positive safe integer.
 */
export function tryParseCrmId(value: string | null | undefined): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const trimmed = value.trim();
  const parsed = Number.parseInt(trimmed, 10);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    String(parsed) !== trimmed
  ) {
    return undefined;
  }
  return parsed;
}
