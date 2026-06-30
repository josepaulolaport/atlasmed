export interface FacilityRecord {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  territoryId: string | null;
  territoryAssignmentStatus: "assigned" | "unassigned" | "ambiguous";
  territoryAssignmentSource: "geo" | "manual";
  sourceProvider: string | null;
  externalSourceId: string | null;
  sourceContentHash: string | null;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  sourcePresent: boolean;
  sourceTracked: boolean;
  manuallyEditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface FacilityListScopeFilter {
  isGlobal: boolean;
  facilityIds?: string[];
}

export interface FacilitySourceUpsertInput {
  sourceProvider: string;
  externalSourceId: string;
  name: string;
  address: string | null;
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
  }): Promise<{ facilities: FacilityRecord[]; total: number }>;

  findById(id: string): Promise<FacilityRecord | null>;

  findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<FacilityRecord | null>;

  findSourceTrackedByProvider(sourceProvider: string): Promise<FacilityRecord[]>;

  create(data: {
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  }): Promise<FacilityRecord>;

  update(
    id: string,
    data: {
      name?: string;
      address?: string | null;
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
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
    }
  ): Promise<FacilityRecord>;
}
