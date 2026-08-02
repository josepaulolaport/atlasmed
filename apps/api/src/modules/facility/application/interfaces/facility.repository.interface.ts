export interface FacilityService {
  serviceCode: string;
  classificationCode: string;
  /** Human-readable CNES service name from `services.service_name`. */
  serviceName: string;
}

export type FacilityCommercialStatus =
  | "UNREGISTERED"
  | "REGISTERED"
  | "SUSPENDED"
  | "CLOSED";

export type FacilityPurchaseStatus =
  | "NON_BUYER"
  | "LOW_BUYER"
  | "REGULAR_BUYER"
  | "HIGH_BUYER";

export type FacilityConformityStatus =
  | "INCOMPLETE"
  | "COMPLETE"
  | "EXPIRING_SOON"
  | "NON_CONFORMING";

export type FacilityPurchaseFunnelStage =
  | "NEVER_PURCHASED"
  | "OUTSIDE_WINDOW"
  | "PURCHASE_WINDOW"
  | "CHURN"
  | "INACTIVE";

/** Purchase recurrence materialized on a facility×vertical profile. */
export interface FacilityVerticalProfilePurchaseRecurrence {
  observedPurchaseIntervalDays: number | null;
  purchaseIntervalDays: number;
  purchaseIntervalSource: "DEFAULT" | "CALCULATED" | "MANUAL";
  manualPurchaseProfile:
    | "WEEKLY"
    | "BIWEEKLY"
    | "MONTHLY"
    | "BIMONTHLY"
    | "QUARTERLY"
    | "SEMIANNUAL"
    | "ANNUAL"
    | "CUSTOM"
    | null;
  manualPurchaseIntervalDays: number | null;
  lastValidPurchaseDate: string | null;
  purchaseRecurrenceSampleSize: number;
  purchaseFunnelStage: FacilityPurchaseFunnelStage;
  nextPurchaseFunnelTransitionDate: string | null;
}

export interface FacilityVerticalProfileRecord {
  verticalId: string;
  verticalCode?: string;
  verticalName?: string;
  isActive: boolean;
  commercialStatus: FacilityCommercialStatus | null;
  purchaseStatus: FacilityPurchaseStatus | null;
  /** Profile membership territory (source of truth; not facilities.territory_id). */
  territoryId?: string | null;
  /** Per-linha funnel/recurrence (orders of this verticalId). */
  purchaseRecurrence?: FacilityVerticalProfilePurchaseRecurrence;
}

export interface FacilityRecord {
  id: string;
  name: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  streetAddress: string | null;
  streetNumber: string | null;
  addressComplement: string | null;
  postalCode: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  /** Email for boletos / NFs (Cadastro required field). */
  billingEmail: string | null;
  responsibleName: string | null;
  openingHours: string | null;
  taxIdType: "PJ" | "PF";
  cnpj: string | null;
  cpf: string | null;
  lat: number | null;
  lng: number | null;
  territoryId: string | null;
  /** Display name of `territoryId` when loaded (list + detail). */
  territoryName: string | null;
  territoryAssignmentStatus: "assigned" | "unassigned" | "ambiguous";
  territoryAssignmentSource: "geo" | "manual";
  commercialStatus: FacilityCommercialStatus | null;
  purchaseStatus: FacilityPurchaseStatus | null;
  observedPurchaseIntervalDays: number | null;
  purchaseIntervalDays: number;
  purchaseIntervalSource: "DEFAULT" | "CALCULATED" | "MANUAL";
  manualPurchaseProfile: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM" | null;
  manualPurchaseIntervalDays: number | null;
  lastValidPurchaseDate: string | null;
  purchaseRecurrenceSampleSize: number;
  purchaseFunnelStage: FacilityPurchaseFunnelStage;
  nextPurchaseFunnelTransitionDate: string | null;
  conformityStatus: FacilityConformityStatus;
  /** Active consultant display name when loaded (list + detail). */
  consultantName: string | null;
  /** Active consultant assignment start (`facility_consultant_assignments.started_at`). */
  consultantSince: Date | null;
  /**
   * Display name of the manager for the clinic's manager zone (zone UTA).
   * Null when there is no open consultant assignment or the consultant has no manager.
   */
  managerName: string | null;
  /** Profile / header image URL (`facilities.image_url`). */
  imageUrl: string | null;
  imageBlurhash: string | null;
  sourceProvider: string | null;
  externalSourceId: string | null;
  sourceContentHash: string | null;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  sourcePresent: boolean;
  sourceTracked: boolean;
  manuallyEditedAt: Date | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Populated only on findById, empty array on list queries. */
  services: FacilityService[];
  /** Loaded when vertical context is resolved; may be empty. */
  verticalProfiles?: FacilityVerticalProfileRecord[];
}

export interface FacilityListRecord extends FacilityRecord {
  professionalCount: number;
  /** Latest visit to this facility by the requesting user. */
  lastVisitAt: Date | null;
  /** Present only when a coordinate query was supplied. */
  distanceKm?: number | null;
}

export interface FacilityListScopeFilter {
  isGlobal: boolean;
  facilityIds?: string[];
  /** Restrict to facilities with active profiles in these verticals (non-ADMIN default). */
  verticalIds?: string[];
  /** When true, only facilities with matching active vertical profiles are returned. */
  restrictToVerticalProfiles?: boolean;
}

/** Thin map pin — no list hydration. */
export interface FacilityMapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Desempenho bucket: active | inactive | neverBought. */
  purchaseBucket: "active" | "inactive" | "neverBought";
}

export interface FacilitySourceUpsertInput {
  sourceProvider: string;
  externalSourceId: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  sourceContentHash: string;
  sourceLastSeenAt: Date;
}

export type FacilityPurchaseProfileFilter = "AUTOMATIC" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";
export type FacilityListSort = "relevance" | "distance" | "name" | "purchaseFunnelStage" | "purchaseIntervalDays" | "lastPurchaseDate";
export type FacilityListOrder = "asc" | "desc";

export interface FacilityRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: FacilityCommercialStatus;
    /** Desempenho donut bucket — see countPurchaseBuckets. */
    purchaseBucket?: "active" | "inactive" | "neverBought";
    /** Comma-separated API values are parsed into IDs; matches any ordered catalog product. */
    productIds?: string[];
    /** CNES service codes — facility must offer at least one. */
    serviceCodes?: string[];
    purchaseFunnelStages?: FacilityPurchaseFunnelStage[];
    purchaseProfile?: FacilityPurchaseProfileFilter;
    purchaseIntervalMinDays?: number;
    purchaseIntervalMaxDays?: number;
    sort?: FacilityListSort;
    order?: FacilityListOrder;
    userId: string;
    scope: FacilityListScopeFilter;
    /** Internal canonical hydration constraint for a Meilisearch result page. */
    candidateIds?: string[];
  }): Promise<{ facilities: FacilityListRecord[]; total: number }>;

  /** Hydrates ranked search candidates while enforcing canonical list eligibility. */
  findAllByIds(params: {
    ids: string[];
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: FacilityCommercialStatus;
    purchaseBucket?: "active" | "inactive" | "neverBought";
    productIds?: string[];
    serviceCodes?: string[];
    purchaseFunnelStages?: FacilityPurchaseFunnelStage[];
    purchaseProfile?: FacilityPurchaseProfileFilter;
    purchaseIntervalMinDays?: number;
    purchaseIntervalMaxDays?: number;
    sort?: FacilityListSort;
    order?: FacilityListOrder;
    userId: string;
    scope: FacilityListScopeFilter;
  }): Promise<FacilityListRecord[]>;

  findById(id: string): Promise<FacilityRecord | null>;

  /** CNES service catalog for Explorar filters (code + name). */
  listServiceCatalog(): Promise<
    Array<{ serviceCode: string; serviceName: string }>
  >;

  findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<FacilityRecord | null>;

  findSourceTrackedByProvider(sourceProvider: string): Promise<FacilityRecord[]>;

  create(data: {
    name: string;
    lat?: number | null;
    lng?: number | null;
  }): Promise<FacilityRecord>;

  update(
    id: string,
    data: {
      name?: string;
      lat?: number | null;
      lng?: number | null;
      imageUrl?: string | null;
      imageBlurhash?: string | null;
      billingEmail?: string | null;
      taxIdType?: "PJ" | "PF";
      conformityStatus?: FacilityConformityStatus;
      manuallyEditedAt?: Date;
    }
  ): Promise<FacilityRecord>;

  softDelete(id: string): Promise<void>;

  reactivate(id: string): Promise<FacilityRecord>;

  markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void>;

  upsertFromSource(input: FacilitySourceUpsertInput): Promise<{
    facility: FacilityRecord;
    created: boolean;
    updated: boolean;
  }>;

  findIdsByTerritoryIds(territoryIds: string[]): Promise<string[]>;

  /**
   * All in-scope geocoded facilities as thin map points (id/name/lat/lng).
   * Used by the live map — no pagination, no list joins.
   */
  listMapPoints(scope: FacilityListScopeFilter): Promise<FacilityMapPoint[]>;

  findActiveFacilityIdsByVerticalIds(verticalIds: string[]): Promise<string[]>;

  findVerticalProfilesByFacilityIds(
    facilityIds: string[],
    verticalIds?: string[],
  ): Promise<Map<string, FacilityVerticalProfileRecord[]>>;

  updateVerticalProfileCommercialStatus(input: {
    facilityId: string;
    verticalId: string;
    commercialStatus: FacilityCommercialStatus;
  }): Promise<void>;

  ensureVerticalProfile(input: {
    facilityId: string;
    verticalId: string;
  }): Promise<FacilityVerticalProfileRecord>;

  applyApprovedFieldUpdates(
    id: string,
    updates: {
      name?: string;
      legalName?: string | null;
      phoneNumber?: string | null;
      whatsappNumber?: string | null;
      email?: string | null;
      websiteUrl?: string | null;
      responsibleName?: string | null;
      openingHours?: string | null;
      taxIdType?: "PJ" | "PF" | null;
      cnpj?: string | null;
      cpf?: string | null;
      neighborhood?: string | null;
      streetAddress?: string | null;
      streetNumber?: string | null;
      addressComplement?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
      lat?: number | null;
      lng?: number | null;
      manuallyEditedAt?: Date;
    }
  ): Promise<FacilityRecord>;
}
