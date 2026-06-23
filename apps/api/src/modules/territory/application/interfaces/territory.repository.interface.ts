import type { TerritoryNodeType } from "@atlasmed/database";

export interface TerritoryRecord {
  id: string;
  name: string;
  code: string;
  nodeType: TerritoryNodeType;
  regionSlug: string | null;
  stateCode: string | null;
  parentId: string | null;
  isActive: boolean;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  activeChildCount?: number;
  clinicCount?: number;
  assignedUserCount?: number;
  hasBoundary?: boolean;
}

export interface CreateTerritoryInput {
  name: string;
  code: string;
  nodeType: TerritoryNodeType;
  regionSlug?: string | null;
  stateCode?: string | null;
  parentId?: string | null;
  organizationId?: string | null;
}

export interface TerritoryRepository {
  findById(id: string): Promise<TerritoryRecord | null>;

  findByCode(code: string): Promise<TerritoryRecord | null>;

  findAllActive(): Promise<TerritoryRecord[]>;

  findChildren(parentId: string, activeOnly?: boolean): Promise<TerritoryRecord[]>;

  countActiveChildren(parentId: string): Promise<number>;

  countClinics(territoryId: string): Promise<number>;

  countAssignedUsers(territoryId: string): Promise<number>;

  countPatchesUnderParent(parentId: string): Promise<number>;

  create(input: CreateTerritoryInput): Promise<TerritoryRecord>;

  update(
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      isActive?: boolean;
      regionSlug?: string | null;
      stateCode?: string | null;
    }
  ): Promise<TerritoryRecord>;

  findActiveRoot(): Promise<TerritoryRecord | null>;
}
