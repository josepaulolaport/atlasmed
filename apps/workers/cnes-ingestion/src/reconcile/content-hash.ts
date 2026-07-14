import { createHash } from "node:crypto";

export function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function computeContentHash(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildFacilityAddress(parts: {
  streetAddress: string | null;
  streetNumber: string | null;
  neighborhood: string | null;
  postalCode: string | null;
}): string | null {
  const segments = [
    parts.streetAddress,
    parts.streetNumber,
    parts.neighborhood,
    parts.postalCode,
  ]
    .map((part) => (part ? normalizeText(part) : ""))
    .filter(Boolean);

  return segments.length > 0 ? segments.join(", ") : null;
}
