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

  /** Returns business vertical IDs assigned to the user. */
  findVerticalIdsByUserId(userId: string): Promise<string[]>;

  assignVertical(params: {
    userId: string;
    verticalId: string;
    assignedByUserId: string;
    managerId?: string | null;
  }): Promise<void>;

  revokeVertical(params: {
    userId: string;
    verticalId: string;
  }): Promise<void>;

  findVerticalAssignmentsByUserId(userId: string): Promise<
    Array<{
      verticalId: string;
      managerId: string | null;
      assignedAt: Date;
    }>
  >;

  /**
   * Atomically replace a user's vertical + territory assignments.
   * Clears existing rows then inserts the provided set.
   */
  replaceAssignments(params: {
    userId: string;
    assignedByUserId: string;
    managerId: string | null;
    verticalAssignments: Array<{
      verticalId: string;
      managerId?: string | null;
      territoryIds: string[];
    }>;
  }): Promise<void>;

  listActiveVerticals(): Promise<Array<{ id: string; code: string; name: string }>>;
}

export interface TerritoryScopePort {
  getFacilityIdsForTerritories(territoryIds: string[]): Promise<string[]>;
  /** Active profiled facilities for the given verticals (OPS scope). */
  getFacilityIdsForVerticals(verticalIds: string[]): Promise<string[]>;
}

/**
 * Clinics linked to a user outside pure territory membership.
 * Today: active `facility_consultant_assignments` only.
 */
export interface FacilityAssociationPort {
  getAssociatedFacilityIds(
    userId: string,
    verticalIds?: string[],
  ): Promise<string[]>;
}

export interface TerritoryHierarchyPort {
  resolveEffectiveTerritoryIds(
    assignedTerritoryIds: string[],
    activeOnly?: boolean
  ): Promise<string[]>;
}
