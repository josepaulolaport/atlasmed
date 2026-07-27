import type { FacilityListRecord, FacilityRecord, FacilityVerticalProfileRecord } from "../interfaces/facility.repository.interface";
import { applyVerticalProfileContext } from "../utils/facility-vertical-scope.utils";

/**
 * Application → HTTP DTO for facilities.
 * Keeps serialization out of use-cases (SRP) and is the single place that
 * shapes the public facility contract for list + detail.
 */
export function serializeFacility(
  clinic: FacilityRecord | FacilityListRecord,
  verticalIds?: string[],
) {
  const list = clinic as FacilityListRecord;
  const verticalContext = applyVerticalProfileContext(clinic, verticalIds);

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
    ...(verticalContext.commercialStatus !== undefined
      ? { commercialStatus: verticalContext.commercialStatus }
      : {}),
    ...(verticalContext.verticalProfiles
      ? {
          verticalProfiles: verticalContext.verticalProfiles.map(serializeVerticalProfile),
        }
      : {}),
    conformityStatus: clinic.conformityStatus,
    purchaseRecurrence: {
      observedIntervalDays: clinic.observedPurchaseIntervalDays,
      intervalDays: clinic.purchaseIntervalDays,
      source: clinic.purchaseIntervalSource,
      profile: clinic.manualPurchaseProfile,
      manualIntervalDays: clinic.manualPurchaseIntervalDays,
      lastPurchaseDate: clinic.lastValidPurchaseDate,
      sampleSize: clinic.purchaseRecurrenceSampleSize,
      funnelStage: clinic.purchaseFunnelStage,
      nextTransitionDate: clinic.nextPurchaseFunnelTransitionDate,
    },
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

function serializeVerticalProfile(profile: FacilityVerticalProfileRecord) {
  return {
    verticalId: profile.verticalId,
    verticalCode: profile.verticalCode,
    verticalName: profile.verticalName,
    isActive: profile.isActive,
    commercialStatus: profile.commercialStatus ?? undefined,
    purchaseStatus: profile.purchaseStatus ?? undefined,
    territoryId: profile.territoryId ?? undefined,
  };
}

export type FacilityDto = ReturnType<typeof serializeFacility>;
