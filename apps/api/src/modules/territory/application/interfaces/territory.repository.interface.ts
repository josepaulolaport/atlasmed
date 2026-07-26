import type { Role } from "@atlasmed/access";
import type { TerritoryTypeRecord } from "./territory-type.repository.interface";

export interface TerritoryRecord {
  id: string;
  name: string;
  slug: string;
  code: string;
  verticalId: string;
  territoryTypeId: string;
  territoryType?: TerritoryTypeRecord;
  managerTerritoryId: string | null;
  isActive: boolean;
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
  verticalId: string;
  territoryTypeId: string;
  managerTerritoryId?: string | null;
}

export interface TerritoryRepository {
  findById(id: string): Promise<TerritoryRecord | null>;

  findBySlug(slug: string, verticalId?: string): Promise<TerritoryRecord | null>;

  findByCode(code: string, verticalId?: string): Promise<TerritoryRecord | null>;

  findAllActive(verticalId?: string): Promise<TerritoryRecord[]>;

  findActiveByTypeSlug(typeSlug: string, verticalId?: string): Promise<TerritoryRecord[]>;

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
    }
  ): Promise<TerritoryRecord>;

  findRepPatchIdsByManagerTerritoryIds(managerTerritoryIds: string[]): Promise<string[]>;

  findByIds(ids: string[]): Promise<TerritoryRecord[]>;

  /**
   * Finds other users (excluding `excludeUserId`) whose role is in `roles`
   * and who already hold an assignment on `territoryId`. Used to enforce
   * "one user per role-group per territory" assignment conflicts.
   */
  findConflictingAssignments(params: {
    territoryId: string;
    excludeUserId: string;
    roles: Role[];
  }): Promise<Array<{ userId: string }>>;
}
