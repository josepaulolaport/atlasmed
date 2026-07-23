import type { FacilityRepresentativeRecord } from "../interfaces/facility-representative.repository.interface";

/**
 * Application → HTTP DTO for CRM facility representatives.
 * `relationshipLevel` is the authenticated user's score (1–10), when provided.
 */
export function serializeFacilityRepresentative(
  row: FacilityRepresentativeRecord,
  relationshipLevel?: number | null
) {
  return {
    id: row.id,
    facilityId: row.facilityId,
    representativeName: row.representativeName,
    roleTitle: row.roleTitle,
    email: row.email,
    phone: row.phone,
    taxId: row.taxId,
    contactType: row.contactType,
    isPartner: row.isPartner,
    isAdministrator: row.isAdministrator,
    isDecisionMaker: row.isDecisionMaker,
    isBuyer: row.isBuyer,
    isBiller: row.isBiller,
    isSecretary: row.isSecretary,
    relationshipLevel: relationshipLevel ?? undefined,
    sourceProvider: row.sourceProvider,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type FacilityRepresentativeDto = ReturnType<
  typeof serializeFacilityRepresentative
>;
