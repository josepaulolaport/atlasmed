export interface FacilityService {
  serviceCode: string;
  classificationCode: string;
}

export interface FacilityRecord {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  taxIdType: "PJ" | "PF" | null;
  cnpj: string | null;
  cpf: string | null;
  lat: number | null;
  lng: number | null;
  territoryId: string | null;
  territoryAssignmentStatus: "assigned" | "unassigned" | "ambiguous";
  territoryAssignmentSource: "geo" | "manual";
  purchaseStatus: "NON_BUYER" | "LOW_BUYER" | "REGULAR_BUYER" | "HIGH_BUYER" | null;
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
  consultantName: string | null;
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
    scope: FacilityListScopeFilter;
  }): Promise<{ facilities: FacilityListRecord[]; total: number }>;

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
      lat?: number | null;
      lng?: number | null;
    }
  ): Promise<FacilityRecord>;
}
