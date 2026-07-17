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

  findUserIdsByTerritoryId(territoryId: string): Promise<
    Array<{
      userId: string;
      assignedAt: Date;
    }>
  >;

  findManagerIdByUserId(userId: string): Promise<string | null>;

  /** Returns sector IDs assigned to the user. Empty array = no sector filter. */
  findSectorIdsByUserId(userId: string): Promise<string[]>;

  /**
   * Returns territory IDs whose sector_id is in the given sector list.
   * Used by ScopeResolver to intersect user's territory assignments with their sectors.
   */
  findTerritoryIdsBySectorIds(sectorIds: string[]): Promise<string[]>;

  assignSector(params: {
    userId: string;
    sectorId: string;
    assignedByUserId: string;
  }): Promise<void>;

  revokeSector(params: {
    userId: string;
    sectorId: string;
  }): Promise<void>;

  findSectorAssignmentsByUserId(userId: string): Promise<
    Array<{
      sectorId: string;
      assignedAt: Date;
    }>
  >;

  listActiveSectors(): Promise<Array<{ id: string; slug: string; name: string }>>;
}

export interface TerritoryScopePort {
  getFacilityIdsForTerritories(territoryIds: string[]): Promise<string[]>;
}

export interface TerritoryHierarchyPort {
  resolveEffectiveTerritoryIds(
    assignedTerritoryIds: string[],
    activeOnly?: boolean
  ): Promise<string[]>;
}
