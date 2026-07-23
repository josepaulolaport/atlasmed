import type { FacilityListRecord, FacilityRecord } from "../interfaces/facility.repository.interface";

/**
 * Application → HTTP DTO for facilities.
 * Keeps serialization out of use-cases (SRP) and is the single place that
 * shapes the public facility contract for list + detail.
 */
export function serializeFacility(
  clinic: FacilityRecord | FacilityListRecord
) {
  const list = clinic as FacilityListRecord;

  return {
    id: clinic.id,
    name: clinic.name,
    neighborhood: clinic.neighborhood,
    city: clinic.city,
    state: clinic.state,
    streetAddress: clinic.streetAddress,
    streetNumber: clinic.streetNumber,
    addressComplement: clinic.addressComplement,
    postalCode: clinic.postalCode,
    phone: clinic.phone,
    whatsapp: clinic.whatsapp,
    email: clinic.email,
    website: clinic.website,
    billingEmail: clinic.billingEmail,
    responsibleName: clinic.responsibleName,
    openingHours: clinic.openingHours,
    /** "Cliente desde" — system createdAt until a dedicated commercial date exists. */
    registeredSince: clinic.createdAt.toISOString(),
    taxIdType: clinic.taxIdType,
    cnpj: clinic.cnpj,
    cpf: clinic.cpf,
    lat: clinic.lat ?? undefined,
    lng: clinic.lng ?? undefined,
    territoryId: clinic.territoryId ?? undefined,
    territoryName: clinic.territoryName ?? undefined,
    territoryAssignmentStatus: clinic.territoryAssignmentStatus,
    commercialStatus: clinic.commercialStatus ?? undefined,
    conformityStatus: clinic.conformityStatus,
    // purchaseStatus stays off the public DTO until Spec 0005 Sinais wire it.
    professionalCount: list.professionalCount ?? 0,
    consultantName: clinic.consultantName,
    consultantSince: clinic.consultantSince?.toISOString() ?? undefined,
    managerName: clinic.managerName,
    imageUrl: clinic.imageUrl ?? undefined,
    distanceKm: list.distanceKm ?? undefined,
    services: clinic.services ?? [],
    createdAt: clinic.createdAt.toISOString(),
    updatedAt: clinic.updatedAt.toISOString(),
  };
}

export type FacilityDto = ReturnType<typeof serializeFacility>;
