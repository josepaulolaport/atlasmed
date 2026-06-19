import { z } from "zod";
import { computeContentHash, normalizeText } from "./content-hash";
import type { SanitizedClinicRecord } from "../interfaces/registry-source.port";

const clinicSchema = z.object({
  externalSourceId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional().nullable(),
  territoryId: z.string().trim().min(1).max(200).optional().nullable(),
});

export function sanitizeClinicRecord(raw: unknown): SanitizedClinicRecord | null {
  const parsed = clinicSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const name = normalizeText(parsed.data.name);
  const address = parsed.data.address ? normalizeText(parsed.data.address) : null;
  const territoryId = parsed.data.territoryId
    ? normalizeText(parsed.data.territoryId)
    : null;

  const contentHash = computeContentHash({
    externalSourceId: parsed.data.externalSourceId,
    name,
    address,
    territoryId,
  });

  return {
    externalSourceId: parsed.data.externalSourceId,
    name,
    address,
    territoryId,
    contentHash,
  };
}

export function sanitizeClinicBatch(
  records: unknown[]
): { valid: SanitizedClinicRecord[]; invalidCount: number } {
  const valid: SanitizedClinicRecord[] = [];
  let invalidCount = 0;

  for (const record of records) {
    const sanitized = sanitizeClinicRecord(record);
    if (sanitized) {
      valid.push(sanitized);
    } else {
      invalidCount += 1;
    }
  }

  return { valid, invalidCount };
}
