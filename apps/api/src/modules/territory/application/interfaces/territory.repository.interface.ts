import type {
  TerritoryNodeType,
} from "@atlasmed/database";
import type { TerritoryTypeRecord } from "./territory-type.repository.interface";

export interface TerritoryRecord {
  id: string;
  name: string;
  slug: string;
  code: string;
  nodeType: TerritoryNodeType;
  territoryTypeId: string;
  territoryType?: TerritoryTypeRecord;
  countryCode: string | null;
  regionSlug: string | null;
  stateCode: string | null;
  parentId: string | null;
  managerTerritoryId: string | null;
  isActive: boolean;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  activeChildCount?: number;
  clinicCount?: number;
  assignedUserCount?: number;
  hasBoundary?: boolean;
  repPatchCount?: number;
}

export interface CreateTerritoryInput {
  name: string;
  slug: string;
  code?: string;
  nodeType: TerritoryNodeType;
  territoryTypeId: string;
  countryCode?: string | null;
  regionSlug?: string | null;
  stateCode?: string | null;
  parentId?: string | null;
  managerTerritoryId?: string | null;
  organizationId?: string | null;
}

export interface TerritoryRepository {
  findById(id: string): Promise<TerritoryRecord | null>;

  findBySlug(slug: string): Promise<TerritoryRecord | null>;

  findByCode(code: string): Promise<TerritoryRecord | null>;

  findAllActive(): Promise<TerritoryRecord[]>;

  findActiveByTypeSlug(typeSlug: string): Promise<TerritoryRecord[]>;

  findChildren(parentId: string, activeOnly?: boolean): Promise<TerritoryRecord[]>;

  countActiveChildren(parentId: string): Promise<number>;

  countRepPatchesByManagerZone(managerTerritoryId: string): Promise<number>;

  countClinics(territoryId: string): Promise<number>;

  countAssignedUsers(territoryId: string): Promise<number>;

  create(input: CreateTerritoryInput): Promise<TerritoryRecord>;

  update(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      managerTerritoryId?: string | null;
      isActive?: boolean;
      countryCode?: string | null;
    }
  ): Promise<TerritoryRecord>;

  findActiveCountryByCode(countryCode: string): Promise<TerritoryRecord | null>;

  findRepPatchIdsByManagerTerritoryIds(managerTerritoryIds: string[]): Promise<string[]>;

  findByIds(ids: string[]): Promise<TerritoryRecord[]>;
}
