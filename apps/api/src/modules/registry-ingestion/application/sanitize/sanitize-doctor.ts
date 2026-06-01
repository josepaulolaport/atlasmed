import { z } from "zod";
import { computeContentHash, normalizeText } from "./content-hash";
import type { SanitizedDoctorRecord } from "../interfaces/registry-source.port";

const doctorSchema = z.object({
  externalSourceId: z.string().trim().min(1).max(200),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  specialty: z.string().trim().max(200).optional().nullable(),
});

export function sanitizeDoctorRecord(raw: unknown): SanitizedDoctorRecord | null {
  const parsed = doctorSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const firstName = normalizeText(parsed.data.firstName);
  const lastName = normalizeText(parsed.data.lastName);
  const specialty = parsed.data.specialty ? normalizeText(parsed.data.specialty) : null;

  const contentHash = computeContentHash({
    externalSourceId: parsed.data.externalSourceId,
    firstName,
    lastName,
    specialty,
  });

  return {
    externalSourceId: parsed.data.externalSourceId,
    firstName,
    lastName,
    specialty,
    contentHash,
  };
}

export function sanitizeDoctorBatch(
  records: unknown[]
): { valid: SanitizedDoctorRecord[]; invalidCount: number } {
  const valid: SanitizedDoctorRecord[] = [];
  let invalidCount = 0;

  for (const record of records) {
    const sanitized = sanitizeDoctorRecord(record);
    if (sanitized) {
      valid.push(sanitized);
    } else {
      invalidCount += 1;
    }
  }

  return { valid, invalidCount };
}
