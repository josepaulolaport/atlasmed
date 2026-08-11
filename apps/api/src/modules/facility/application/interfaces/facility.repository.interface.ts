export interface FacilityClinicalFocus {
  id: number;
  name: string;
  /** Optional CNES code when mapped from official catalogs. */
  cnesCode: string | null;
}

export interface FacilityUnitSubtype {
  id: number;
  /** CNES code, unique only within the parent unit type. */
  cnesId: string;
  name: string;
}

export interface FacilityUnitType {
  id: number;
  cnesId: string;
  name: string;
  subtypes: FacilityUnitSubtype[];
}

export type FacilityCommercialStatus =
  | "UNREGISTERED"
  | "REGISTERED"
  | "SUSPENDED"
  | "CLOSED";


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
  /** The profile row's own id — cadastro documents key on it (ADR 0007). */
  id: number;
  verticalId: number;
  verticalCode?: string;
  verticalName?: string;
  isActive: boolean;
  commercialStatus: FacilityCommercialStatus | null;
  /** Profile membership territory (source of truth; not facilities.territory_id). */
  territoryId?: number | null;
  /** Per-linha funnel/recurrence (orders of this verticalId). */
  purchaseRecurrence?: FacilityVerticalProfilePurchaseRecurrence;
}

export interface FacilityRecord {
  id: number;
  name: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  streetAddress: string | null;
  streetNumber: string | null;
  addressComplement: string | null;
  postalCode: string | null;
  /** Admin geography FK (`states.id`); never null. */
  stateId: number;
  /** Admin geography FK (`municipalities.id`); never null; belongs to `stateId`. */
  municipalityId: number;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  /** Email for boletos / NFs (Cadastro required field). */
  billingEmail: string | null;
  responsibleName: string | null;
  openingHours: string | null;
  legalDocumentType: "CNPJ" | "CPF";
  legalDocument: string | null;
  lat: number | null;
  lng: number | null;
  territoryId: number | null;
  /** Display name of `territoryId` when loaded (list + detail). */
  territoryName: string | null;
  /**
   * Derived from active vertical profiles: `assigned` if any has managerZoneId,
   * otherwise `unassigned`. Not persisted on facilities.
   */
  territoryAssignmentStatus: "assigned" | "unassigned";
  commercialStatus: FacilityCommercialStatus | null;
  /** Active consultant display name when loaded (list + detail). */
  consultantName: string | null;
  /** Active vertical REP assignment start (`facility_vertical_rep_assignments.started_at`). */
  consultantSince: Date | null;
  /**
   * Display name of the manager for the clinic's manager zone (zone UTA).
   * Null when there is no open consultant assignment or the consultant has no manager.
   */
  managerName: string | null;
  /** Profile / header image URL (`facilities.image_url`). */
  imageUrl: string | null;
  imageBlurhash: string | null;
  cnesCode: string | null;
  /** CNES TP_UNIDADE → unit_types.id. */
  unitTypeId: number | null;
  /** CNES subtype → unit_subtypes.id (must belong to unitTypeId when both set). */
  unitSubtypeId: number | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Clinical focuses linked to this facility (list + detail). */
  clinicalFocuses: FacilityClinicalFocus[];
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
  facilityIds?: number[];
  /** Restrict to facilities with active profiles in these verticals (non-ADMIN default). */
  verticalIds?: number[];
  /** When true, only facilities with matching active vertical profiles are returned. */
  restrictToVerticalProfiles?: boolean;
}

/** Thin map pin — no list hydration. */
export interface FacilityMapPoint {
  id: number;
  name: string;
  lat: number;
  lng: number;
  /** Desempenho bucket: active | inactive | neverBought. */
  purchaseBucket: "active" | "inactive" | "neverBought";
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
    productIds?: number[];
    /** Clinical focus IDs — facility must offer every selected (AND). */
    clinicalFocusIds?: number[];
    purchaseFunnelStages?: FacilityPurchaseFunnelStage[];
    purchaseProfile?: FacilityPurchaseProfileFilter;
    purchaseIntervalMinDays?: number;
    purchaseIntervalMaxDays?: number;
    sort?: FacilityListSort;
    order?: FacilityListOrder;
    userId: number;
    scope: FacilityListScopeFilter;
    /** Internal canonical hydration constraint for a Meilisearch result page. */
    candidateIds?: number[];
  }): Promise<{ facilities: FacilityListRecord[]; total: number }>;

  /** Hydrates ranked search candidates while enforcing canonical list eligibility. */
  findAllByIds(params: {
    ids: number[];
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: FacilityCommercialStatus;
    purchaseBucket?: "active" | "inactive" | "neverBought";
    productIds?: number[];
    clinicalFocusIds?: number[];
    purchaseFunnelStages?: FacilityPurchaseFunnelStage[];
    purchaseProfile?: FacilityPurchaseProfileFilter;
    purchaseIntervalMinDays?: number;
    purchaseIntervalMaxDays?: number;
    sort?: FacilityListSort;
    order?: FacilityListOrder;
    userId: number;
    scope: FacilityListScopeFilter;
  }): Promise<FacilityListRecord[]>;

  findById(id: number): Promise<FacilityRecord | null>;

  /** Clinical focus catalog for Explorar filters. */
  listClinicalFocusCatalog(): Promise<FacilityClinicalFocus[]>;

  /**
   * Unit-type catalog with its subtypes (spec 0014 item 14).
   *
   * `facilities.unit_type_id` has been readable for a long time and resolvable
   * by nobody: the DTO emits the raw id and no endpoint exposed the catalog, so
   * a client could show "42" and not "CLINICA/CENTRO DE ESPECIALIDADE". That is
   * the reason spec 0014 §5 lists the `unit_type` dashboard filter as unable to
   * ship — a filter whose options have no names is not a filter.
   *
   * Subtypes are nested rather than served separately because they are
   * meaningless alone: `unit_subtypes.cnes_id` is unique only within its parent
   * type, so a flat list would carry colliding codes.
   */
  listUnitTypeCatalog(): Promise<FacilityUnitType[]>;

  /**
   * Creates the facility **and** its vertical profile atomically.
   * The profile is what makes a clinic visible in a vertical (spec 0010 §1.2),
   * so a facility must never exist without one.
   */
  create(data: {
    name: string;
    stateId: number;
    municipalityId: number;
    legalDocumentType: "CNPJ" | "CPF";
    legalDocument?: string | null;
    lat?: number | null;
    lng?: number | null;
    /** Vertical the created facility gets its first profile in. */
    verticalId: number;
  }): Promise<FacilityRecord>;

  update(
    id: number,
    data: {
      name?: string;
      lat?: number | null;
      lng?: number | null;
      imageUrl?: string | null;
      imageBlurhash?: string | null;
      billingEmail?: string | null;
      legalDocumentType?: "CNPJ" | "CPF";
      legalDocument?: string | null;
      conformityStatus?: FacilityConformityStatus;
    }
  ): Promise<FacilityRecord>;

  softDelete(id: number): Promise<void>;

  reactivate(id: number): Promise<FacilityRecord>;

  findIdsByTerritoryIds(territoryIds: number[]): Promise<number[]>;

  /**
   * All in-scope geocoded facilities as thin map points (id/name/lat/lng).
   * Used by the live map — no pagination, no list joins.
   */
  listMapPoints(scope: FacilityListScopeFilter): Promise<FacilityMapPoint[]>;

  findActiveFacilityIdsByVerticalIds(verticalIds: number[]): Promise<number[]>;

  findVerticalProfilesByFacilityIds(
    facilityIds: number[],
    verticalIds?: number[],
  ): Promise<Map<number, FacilityVerticalProfileRecord[]>>;

  updateVerticalProfileCommercialStatus(input: {
    facilityId: number;
    verticalId: number;
    commercialStatus: FacilityCommercialStatus;
  }): Promise<void>;

  ensureVerticalProfile(input: {
    facilityId: number;
    verticalId: number;
  }): Promise<FacilityVerticalProfileRecord>;

  applyApprovedFieldUpdates(
    id: number,
    updates: {
      name?: string;
      legalName?: string | null;
      phoneNumber?: string | null;
      whatsappNumber?: string | null;
      email?: string | null;
      websiteUrl?: string | null;
      responsibleName?: string | null;
      openingHours?: string | null;
      legalDocumentType?: "CNPJ" | "CPF" | null;
      legalDocument?: string | null;
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
    }
  ): Promise<FacilityRecord>;
}
