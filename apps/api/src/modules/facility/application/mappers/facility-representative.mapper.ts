import type { FacilityRepresentativeRecord } from "../interfaces/facility-representative.repository.interface";

/**
 * Application → HTTP DTO for CRM facility representatives (F-002).
 * Relationship stars are user×professional only — not returned here.
 */
export function serializeFacilityRepresentative(
  row: FacilityRepresentativeRecord
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
    sourceProvider: row.sourceProvider,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type FacilityRepresentativeDto = ReturnType<
  typeof serializeFacilityRepresentative
>;
