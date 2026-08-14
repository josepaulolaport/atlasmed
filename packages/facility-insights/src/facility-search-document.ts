import { PURCHASE_FUNNEL_STAGES } from "./purchase-recurrence";
import type {
  PurchaseFunnelStage,
  PurchaseIntervalSource,
  PurchaseProfile,
} from "./purchase-recurrence";

export type FacilityProfileFunnelData = {
  verticalId: number;
  purchaseFunnelStage: PurchaseFunnelStage;
  purchaseIntervalDays: number;
  purchaseIntervalSource: PurchaseIntervalSource;
  manualPurchaseProfile: PurchaseProfile | null;
  lastValidPurchaseDate: string | null;
};

/** Meili facilities document shape (worker rebuild + API upsert + recurrence). */
export type FacilitySearchDocument = {
  /** Meilisearch primary key (decimal string of CRM bigint id). */
  id: string;
  name: string;
  legalName: string | null;
  tradeName: string | null;
  legalDocument: string | null;
  cnesCode: string | null;
  city: string | null;
  state: string | null;
  streetAddress: string | null;
  neighborhood: string | null;
  /**
   * CNES unit type. Indexed so a search combined with the unit type filter can
   * be answered by Meili; without it every such request over-matched, lost rows
   * in the SQL hydrate, and fell back to a full SQL query.
   */
  unitTypeId: number | null;
  /** CNPJ or CPF. Indexed for the same reason as [unitTypeId]. */
  legalDocumentType: string | null;
  /**
   * Clinical focuses the facility offers, ascending.
   *
   * Safe to index because nothing in the application writes
   * `facility_clinical_focuses` — it arrives by bulk ingest, which is followed
   * by a full rebuild. Order history is deliberately NOT indexed for the
   * opposite reason: it changes on every order with nothing re-indexing.
   */
  clinicalFocusIds: number[];
  verticalIds: number[];
  territoryIds: number[];
  /** Active rep assignment user ids (compact REP Meili scope). */
  repUserIds: number[];
  territoryAssignmentStatus: string;
  verticalFunnelStages: string[];
  verticalPurchaseIntervalSources: string[];
  verticalManualPurchaseProfiles: string[];
  purchaseFunnelStagesAny: string[];
  purchaseFunnelStageRank: number;
  purchaseIntervalDaysMin: number;
  hasLastValidPurchase: 0 | 1;
  lastValidPurchaseSortAt: number;
  _geo?: { lat: number; lng: number };
};

export function deriveFacilityProfileFunnelFields(profiles: FacilityProfileFunnelData[]): {
  verticalFunnelStages: string[];
  verticalPurchaseIntervalSources: string[];
  verticalManualPurchaseProfiles: string[];
  purchaseFunnelStagesAny: string[];
  purchaseFunnelStageRank: number;
  purchaseIntervalDaysMin: number;
  hasLastValidPurchase: 0 | 1;
  lastValidPurchaseSortAt: number;
} {
  const verticalFunnelStages = profiles.map(
    (profile) => `${profile.verticalId}:${profile.purchaseFunnelStage}`,
  );
  const verticalPurchaseIntervalSources = profiles.map(
    (profile) => `${profile.verticalId}:${profile.purchaseIntervalSource}`,
  );
  const verticalManualPurchaseProfiles = profiles.flatMap((profile) =>
    profile.manualPurchaseProfile === null
      ? []
      : [`${profile.verticalId}:${profile.manualPurchaseProfile}`],
  );
  const purchaseFunnelStagesAny = [
    ...new Set(profiles.map((profile) => profile.purchaseFunnelStage)),
  ];
  const purchaseFunnelStageRank =
    profiles.length === 0
      ? 0
      : Math.max(
          ...profiles.map((profile) =>
            PURCHASE_FUNNEL_STAGES.indexOf(profile.purchaseFunnelStage),
          ),
        );
  const purchaseIntervalDaysMin =
    profiles.length === 0
      ? 30
      : Math.min(...profiles.map((profile) => profile.purchaseIntervalDays));
  const lastValidPurchaseDates = profiles
    .map((profile) => profile.lastValidPurchaseDate)
    .filter((date): date is string => date !== null);
  const lastValidPurchaseSortAt =
    lastValidPurchaseDates.length === 0
      ? 0
      : Math.max(
          ...lastValidPurchaseDates.map((date) =>
            Date.parse(`${date}T00:00:00.000Z`),
          ),
        );

  return {
    verticalFunnelStages,
    verticalPurchaseIntervalSources,
    verticalManualPurchaseProfiles,
    purchaseFunnelStagesAny,
    purchaseFunnelStageRank,
    purchaseIntervalDaysMin,
    hasLastValidPurchase: lastValidPurchaseDates.length === 0 ? 0 : 1,
    lastValidPurchaseSortAt,
  };
}

export function mapFacilitySearchDocument(row: {
  id: number;
  displayName: string;
  legalName: string | null;
  tradeName: string | null;
  legalDocument: string | null;
  cnesCode: string | null;
  city: string | null;
  state: string | null;
  streetAddress?: string | null;
  neighborhood?: string | null;
  unitTypeId?: number | null;
  legalDocumentType?: string | null;
  clinicalFocusIds?: number[];
  verticalIds?: number[];
  territoryIds?: number[];
  repUserIds?: number[];
  profileFunnelData?: FacilityProfileFunnelData[];
  latitude: number | null;
  longitude: number | null;
  deactivatedAt: Date | null;
}): FacilitySearchDocument | null {
  if (row.deactivatedAt) return null;

  const territoryIds = [...new Set(row.territoryIds ?? [])].sort((a, b) => a - b);
  const repUserIds = [...new Set(row.repUserIds ?? [])].sort((a, b) => a - b);
  const clinicalFocusIds = [...new Set(row.clinicalFocusIds ?? [])].sort(
    (a, b) => a - b,
  );
  const profileFunnelData = row.profileFunnelData ?? [];

  return {
    id: String(row.id),
    name: row.displayName,
    legalName: row.legalName,
    tradeName: row.tradeName,
    legalDocument: row.legalDocument,
    cnesCode: row.cnesCode,
    city: row.city,
    state: row.state,
    streetAddress: row.streetAddress ?? null,
    neighborhood: row.neighborhood ?? null,
    unitTypeId: row.unitTypeId ?? null,
    legalDocumentType: row.legalDocumentType ?? null,
    clinicalFocusIds,
    verticalIds: row.verticalIds ?? [],
    territoryIds,
    repUserIds,
    territoryAssignmentStatus:
      territoryIds.length > 0 ? "assigned" : "unassigned",
    ...deriveFacilityProfileFunnelFields(profileFunnelData),
    ...(row.latitude !== null && row.longitude !== null
      ? { _geo: { lat: row.latitude, lng: row.longitude } }
      : {}),
  };
}
