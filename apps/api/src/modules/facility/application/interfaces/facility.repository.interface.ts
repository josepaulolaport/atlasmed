export interface FacilityService {
  serviceCode: string;
  classificationCode: string;
}

export type FacilityCommercialStatus =
  | "REGISTERED"
  | "ACTIVE"
  | "SUSPENDED"
  | "INACTIVE";

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
  responsibleName: string | null;
  openingHours: string | null;
  taxIdType: "PJ" | "PF" | null;
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
  conformityStatus: FacilityConformityStatus;
  /** Active consultant display name when loaded (list + detail). */
  consultantName: string | null;
  /** Active consultant assignment start (`facility_consultant_assignments.started_at`). */
  consultantSince: Date | null;
  /**
   * Display name of the active consultant's manager (`users.manager_id`).
   * Null when there is no open consultant assignment or the consultant has no manager.
   */
  managerName: string | null;
  /** Profile / header image URL (`facilities.image_url`). */
  imageUrl: string | null;
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
}

export interface FacilityListRecord extends FacilityRecord {
  professionalCount: number;
  /** Present only when a coordinate query was supplied. */
  distanceKm?: number | null;
}

export interface FacilityListScopeFilter {
  isGlobal: boolean;
  facilityIds?: string[];
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

export interface FacilityRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    commercialStatus?: FacilityCommercialStatus;
    /** Comma-separated API values are parsed into IDs; matches any ordered catalog product. */
    productIds?: string[];
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
    productIds?: string[];
    scope: FacilityListScopeFilter;
  }): Promise<FacilityListRecord[]>;

  findById(id: string): Promise<FacilityRecord | null>;

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
