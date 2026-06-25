import { z } from "zod";
import { computeContentHash, normalizeText } from "./content-hash";
import type { SanitizedClinicRecord } from "../interfaces/registry-source.port";

const clinicSchema = z.object({
  externalSourceId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
});

export function sanitizeClinicRecord(raw: unknown): SanitizedClinicRecord | null {
  const parsed = clinicSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const name = normalizeText(parsed.data.name);
  const address = parsed.data.address ? normalizeText(parsed.data.address) : null;
  const lat = parsed.data.lat ?? null;
  const lng = parsed.data.lng ?? null;

  const contentHash = computeContentHash({
    externalSourceId: parsed.data.externalSourceId,
    name,
    address,
    lat,
    lng,
  });

  return {
    externalSourceId: parsed.data.externalSourceId,
    name,
    address,
    lat,
    lng,
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
