export interface ClinicRecord {
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

export interface ClinicListScopeFilter {
  isGlobal: boolean;
  clinicIds?: string[];
}

export interface ClinicSourceUpsertInput {
  sourceProvider: string;
  externalSourceId: string;
  name: string;
  address: string | null;
  lat?: number | null;
  lng?: number | null;
  sourceContentHash: string;
  sourceLastSeenAt: Date;
}

export interface ClinicRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    scope: ClinicListScopeFilter;
  }): Promise<{ clinics: ClinicRecord[]; total: number }>;

  findById(id: string): Promise<ClinicRecord | null>;

  findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<ClinicRecord | null>;

  findSourceTrackedByProvider(sourceProvider: string): Promise<ClinicRecord[]>;

  create(data: {
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  }): Promise<ClinicRecord>;

  update(
    id: string,
    data: {
      name?: string;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      manuallyEditedAt?: Date;
    }
  ): Promise<ClinicRecord>;

  softDelete(id: string): Promise<void>;

  reactivate(id: string): Promise<ClinicRecord>;

  markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void>;

  upsertFromSource(input: ClinicSourceUpsertInput): Promise<{
    clinic: ClinicRecord;
    created: boolean;
    updated: boolean;
  }>;

  findIdsByTerritoryIds(territoryIds: string[]): Promise<string[]>;
}
