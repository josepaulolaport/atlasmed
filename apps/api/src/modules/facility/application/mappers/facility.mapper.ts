import type { FacilityListRecord, FacilityRecord, FacilityVerticalProfileRecord } from "../interfaces/facility.repository.interface";
import { applyVerticalProfileContext } from "../utils/facility-vertical-scope.utils";

/**
 * Application → HTTP DTO for facilities.
 * Keeps serialization out of use-cases (SRP) and is the single place that
 * shapes the public facility contract for list + detail.
 */

/**
 * Calcula a próxima data estimada de compra com base na última compra e o intervalo.
 * Retorna null quando não há data de última compra.
 */
function calculateNextEstimatedPurchaseDate(
  lastPurchaseDate: string | null,
  intervalDays: number,
): string | null {
  if (!lastPurchaseDate) return null;

  const lastDate = new Date(lastPurchaseDate);
  if (isNaN(lastDate.getTime())) return null;

  const nextDate = new Date(lastDate.getTime() + intervalDays * 86_400_000);
  return nextDate.toISOString();
}

function serializePurchaseRecurrence(recurrence: {
  observedPurchaseIntervalDays: number | null;
  purchaseIntervalDays: number;
  purchaseIntervalSource: string;
  manualPurchaseProfile: string | null;
  manualPurchaseIntervalDays: number | null;
  lastValidPurchaseDate: string | null;
  purchaseRecurrenceSampleSize: number;
  purchaseFunnelStage: string;
  nextPurchaseFunnelTransitionDate: string | null;
}) {
  return {
    observedIntervalDays: recurrence.observedPurchaseIntervalDays,
    intervalDays: recurrence.purchaseIntervalDays,
    source: recurrence.purchaseIntervalSource,
    profile: recurrence.manualPurchaseProfile,
    manualIntervalDays: recurrence.manualPurchaseIntervalDays,
    lastPurchaseDate: recurrence.lastValidPurchaseDate,
    nextEstimatedPurchaseDate: calculateNextEstimatedPurchaseDate(
      recurrence.lastValidPurchaseDate,
      recurrence.purchaseIntervalDays,
    ),
    sampleSize: recurrence.purchaseRecurrenceSampleSize,
    funnelStage: recurrence.purchaseFunnelStage,
    nextTransitionDate: recurrence.nextPurchaseFunnelTransitionDate,
  };
}

export function serializeFacility(
  clinic: FacilityRecord | FacilityListRecord,
  verticalIds?: number[],
  options?: { exposeProfileVerticalIds?: number[] },
) {
  const list = clinic as FacilityListRecord;
  const verticalContext = applyVerticalProfileContext(clinic, verticalIds, {
    exposeProfileVerticalIds: options?.exposeProfileVerticalIds,
  });

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
    stateId: clinic.stateId,
    municipalityId: clinic.municipalityId,
    phone: clinic.phone,
    whatsapp: clinic.whatsapp,
    email: clinic.email,
    website: clinic.website,
    billingEmail: clinic.billingEmail,
    responsibleName: clinic.responsibleName,
    openingHours: clinic.openingHours,
    /** "Cliente desde" — system createdAt until a dedicated commercial date exists. */
    registeredSince: clinic.createdAt.toISOString(),
    legalDocumentType: clinic.legalDocumentType,
    legalDocument: clinic.legalDocument,
    lat: clinic.lat ?? undefined,
    lng: clinic.lng ?? undefined,
    territoryId: clinic.territoryId ?? undefined,
    territoryName: clinic.territoryName ?? undefined,
    territoryAssignmentStatus: clinic.territoryAssignmentStatus,
    // Commercial / purchase / recurrence: only on verticalProfiles (per Linha).
    ...(verticalContext.verticalProfiles
      ? {
          verticalProfiles: verticalContext.verticalProfiles.map(serializeVerticalProfile),
        }
      : {}),
    professionalCount: list.professionalCount ?? 0,
    lastVisitAt: list.lastVisitAt?.toISOString() ?? undefined,
    consultantName: clinic.consultantName,
    consultantSince: clinic.consultantSince?.toISOString() ?? undefined,
    managerName: clinic.managerName,
    imageUrl: clinic.imageUrl ?? undefined,
    imageBlurhash: clinic.imageBlurhash ?? undefined,
    cnesCode: clinic.cnesCode ?? undefined,
    unitTypeId: clinic.unitTypeId ?? undefined,
    unitSubtypeId: clinic.unitSubtypeId ?? undefined,
    distanceKm: list.distanceKm ?? undefined,
    clinicalFocuses: clinic.clinicalFocuses ?? [],
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
    territoryId: profile.territoryId ?? undefined,
    ...(profile.purchaseRecurrence
      ? {
          purchaseRecurrence: serializePurchaseRecurrence(profile.purchaseRecurrence),
        }
      : {}),
  };
}

export type FacilityDto = ReturnType<typeof serializeFacility>;
