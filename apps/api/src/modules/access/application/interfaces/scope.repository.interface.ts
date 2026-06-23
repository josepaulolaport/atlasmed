export interface ScopeRepository {
  findTerritoryIdsByUserId(userId: string): Promise<string[]>;

  findTerritoryIdsByUserIds(userIds: string[]): Promise<string[]>;

  findManagedUserIds(managerId: string): Promise<string[]>;

  assignTerritory(params: {
    userId: string;
    territoryId: string;
    assignedBy: string;
  }): Promise<void>;

  revokeTerritory(params: {
    userId: string;
    territoryId: string;
  }): Promise<void>;

  findTerritoryAssignmentsByUserId(userId: string): Promise<
    Array<{
      territoryId: string;
      assignedAt: Date;
    }>
  >;

  findManagerIdByUserId(userId: string): Promise<string | null>;
}

export interface TerritoryScopePort {
  getClinicIdsForTerritories(territoryIds: string[]): Promise<string[]>;
}

export interface TerritoryHierarchyPort {
  resolveDescendantIds(ancestorIds: string[], activeOnly?: boolean): Promise<string[]>;
}
