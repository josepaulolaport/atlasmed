import type { TerritoryTypeRecord } from "./territory-type.repository.interface";

export interface TerritoryRecord {
  id: string;
  name: string;
  slug: string;
  code: string;
  territoryTypeId: string;
  territoryType?: TerritoryTypeRecord;
  managerTerritoryId: string | null;
  isActive: boolean;
  sectorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  clinicCount?: number;
  assignedUserCount?: number;
  hasBoundary?: boolean;
  repPatchCount?: number;
}

export interface CreateTerritoryInput {
  name: string;
  slug: string;
  code?: string;
  territoryTypeId: string;
  managerTerritoryId?: string | null;
  sectorId?: string | null;
}

export interface TerritoryRepository {
  findById(id: string): Promise<TerritoryRecord | null>;

  findBySlug(slug: string): Promise<TerritoryRecord | null>;

  findByCode(code: string): Promise<TerritoryRecord | null>;

  findAllActive(): Promise<TerritoryRecord[]>;

  findActiveByTypeSlug(typeSlug: string): Promise<TerritoryRecord[]>;

  countRepPatchesByManagerZone(managerTerritoryId: string): Promise<number>;

  countClinics(territoryId: string): Promise<number>;

  countAssignedUsers(territoryId: string): Promise<number>;

  create(input: CreateTerritoryInput): Promise<TerritoryRecord>;

  update(
    id: string,
    data: {
      name?: string;
      managerTerritoryId?: string | null;
      isActive?: boolean;
      sectorId?: string | null;
    }
  ): Promise<TerritoryRecord>;

  findRepPatchIdsByManagerTerritoryIds(managerTerritoryIds: string[]): Promise<string[]>;

  findByIds(ids: string[]): Promise<TerritoryRecord[]>;
}
