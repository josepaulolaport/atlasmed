import type { Role } from "@atlasmed/access";
import type { TerritoryTypeRecord } from "./territory-type.repository.interface";

export interface TerritoryRecord {
  id: number;
  name: string;
  slug: string;
  verticalId: number;
  territoryTypeId: number;
  territoryType?: TerritoryTypeRecord;
  managerTerritoryId: number | null;
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
  verticalId: number;
  territoryTypeId: number;
  managerTerritoryId?: number | null;
}

export interface TerritoryRepository {
  findById(id: number): Promise<TerritoryRecord | null>;

  findBySlug(slug: string, verticalId?: number): Promise<TerritoryRecord | null>;

  findAllActive(verticalId?: number): Promise<TerritoryRecord[]>;

  findActiveByTypeSlug(typeSlug: string, verticalId?: number): Promise<TerritoryRecord[]>;

  countRepPatchesByManagerZone(managerTerritoryId: number): Promise<number>;

  countClinics(territoryId: number): Promise<number>;

  countAssignedUsers(territoryId: number): Promise<number>;

  create(input: CreateTerritoryInput): Promise<TerritoryRecord>;

  update(
    id: number,
    data: {
      name?: string;
      managerTerritoryId?: number | null;
      isActive?: boolean;
    }
  ): Promise<TerritoryRecord>;

  findRepPatchIdsByManagerTerritoryIds(managerTerritoryIds: number[]): Promise<number[]>;

  findByIds(ids: number[]): Promise<TerritoryRecord[]>;

  /**
   * Finds other users (excluding `excludeUserId`) whose role is in `roles`
   * and who already hold an assignment on `territoryId`. Used to enforce
   * "one user per role-group per territory" assignment conflicts.
   */
  findConflictingAssignments(params: {
    territoryId: number;
    excludeUserId: number;
    roles: Role[];
  }): Promise<Array<{ userId: number }>>;
}
