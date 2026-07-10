import { db } from "../../../../infrastructure/database/db";
import { facilities, professionals, ingestionSuggestions, facilityProfessionals, ingestionRuns } from "@atlasmed/database";
import { eq, or, inArray } from "drizzle-orm";
import { MOCK_REGISTRY_PROVIDER } from "../../application/interfaces/registry-source.port";

export async function cleanupMockRegistryData(): Promise<void> {
  const mockClinics = await db
    .select({ id: facilities.id })
    .from(facilities)
    .where(eq(facilities.sourceProvider, MOCK_REGISTRY_PROVIDER));

  const mockDoctors = await db
    .select({ id: professionals.id })
    .from(professionals)
    .where(eq(professionals.sourceProvider, MOCK_REGISTRY_PROVIDER));

  const facilityIds = mockClinics.map((c) => c.id);
  const professionalIds = mockDoctors.map((d) => d.id);

  if (facilityIds.length > 0 || professionalIds.length > 0) {
    const suggestionConditions = [
      ...(facilityIds.length > 0 ? [inArray(ingestionSuggestions.facilityId, facilityIds)] : []),
      ...(professionalIds.length > 0 ? [inArray(ingestionSuggestions.professionalId, professionalIds)] : []),
    ];
    await db.delete(ingestionSuggestions).where(or(...suggestionConditions));

    const fpConditions = [
      ...(facilityIds.length > 0 ? [inArray(facilityProfessionals.facilityId, facilityIds)] : []),
      ...(professionalIds.length > 0 ? [inArray(facilityProfessionals.professionalId, professionalIds)] : []),
    ];
    await db.delete(facilityProfessionals).where(or(...fpConditions));
  }

  await db.delete(ingestionRuns).where(eq(ingestionRuns.sourceProvider, MOCK_REGISTRY_PROVIDER));
  await db.delete(professionals).where(eq(professionals.sourceProvider, MOCK_REGISTRY_PROVIDER));
  await db.delete(facilities).where(eq(facilities.sourceProvider, MOCK_REGISTRY_PROVIDER));
}
