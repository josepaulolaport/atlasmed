import {
  personProfessionalRegistrationCouncils,
  personProfessionalRegistrations,
} from "@atlasmed/database";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../../../infrastructure/database/db";

export function formatPrimaryRegistrationDisplay(input: {
  councilAbbreviation: string;
  stateCode: string;
  registrationNumber: string;
}): string {
  return `${input.councilAbbreviation}/${input.stateCode} ${input.registrationNumber}`;
}

/**
 * Batch-load one display string per person: prefer isPrimary, else first by
 * abbreviation / UF / number (same order as registration list endpoint).
 */
export async function loadPrimaryRegistrationDisplayMap(
  personIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (personIds.length === 0) return map;

  const rows = await db
    .select({
      personId: personProfessionalRegistrations.personId,
      councilAbbreviation: personProfessionalRegistrationCouncils.abbreviation,
      stateCode: personProfessionalRegistrations.stateCode,
      registrationNumber: personProfessionalRegistrations.registrationNumber,
      isPrimary: personProfessionalRegistrations.isPrimary,
    })
    .from(personProfessionalRegistrations)
    .innerJoin(
      personProfessionalRegistrationCouncils,
      eq(
        personProfessionalRegistrations.councilId,
        personProfessionalRegistrationCouncils.id
      )
    )
    .where(
      and(
        inArray(personProfessionalRegistrations.personId, personIds),
        eq(personProfessionalRegistrations.isActive, true)
      )
    );

  rows.sort((left, right) => {
    if (left.personId !== right.personId) return left.personId - right.personId;
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    const byAbbrev = left.councilAbbreviation.localeCompare(
      right.councilAbbreviation,
      "pt-BR"
    );
    if (byAbbrev !== 0) return byAbbrev;
    const byState = left.stateCode.localeCompare(right.stateCode, "pt-BR");
    if (byState !== 0) return byState;
    return left.registrationNumber.localeCompare(
      right.registrationNumber,
      "pt-BR"
    );
  });

  for (const row of rows) {
    if (map.has(row.personId)) continue;
    map.set(
      row.personId,
      formatPrimaryRegistrationDisplay({
        councilAbbreviation: row.councilAbbreviation,
        stateCode: row.stateCode,
        registrationNumber: row.registrationNumber,
      })
    );
  }

  return map;
}
