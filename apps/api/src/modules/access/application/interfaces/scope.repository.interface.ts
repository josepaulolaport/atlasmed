export interface ScopeRepository {
  findTerritoryIdsByUserId(userId: number): Promise<number[]>;

  findTerritoryIdsByUserIds(userIds: number[]): Promise<number[]>;

  findManagedUserIds(managerId: number): Promise<number[]>;

  assignTerritory(params: {
    userId: number;
    territoryId: number;
  }): Promise<void>;

  revokeTerritory(params: {
    userId: number;
    territoryId: number;
  }): Promise<void>;

  findTerritoryAssignmentsByUserId(userId: number): Promise<
    Array<{
      territoryId: number;
      assignedAt: Date;
    }>
  >;

  findUserIdsByTerritoryId(territoryId: number): Promise<
    Array<{
      userId: number;
      assignedAt: Date;
    }>
  >;

  /** Returns business vertical IDs assigned to the user. */
  findVerticalIdsByUserId(userId: number): Promise<number[]>;

  assignVertical(params: {
    userId: number;
    verticalId: number;
    assignedByUserId: number;
    managerId?: number | null;
  }): Promise<void>;

  revokeVertical(params: {
    userId: number;
    verticalId: number;
  }): Promise<void>;

  findVerticalAssignmentsByUserId(userId: number): Promise<
    Array<{
      verticalId: number;
      managerId: number | null;
      assignedAt: Date;
    }>
  >;

  /**
   * Atomically replace a user's vertical + territory assignments.
   * Clears existing rows then inserts the provided set.
   */
  replaceAssignments(params: {
    userId: number;
    assignedByUserId: number;
    verticalAssignments: Array<{
      verticalId: number;
      territoryIds: number[];
    }>;
  }): Promise<void>;

  listActiveVerticals(): Promise<Array<{ id: number; code: string; name: string }>>;
}

export interface TerritoryScopePort {
  getFacilityIdsForTerritories(territoryIds: number[]): Promise<number[]>;
  /** Active profiled facilities for the given verticals (OPS scope). */
  getFacilityIdsForVerticals(verticalIds: number[]): Promise<number[]>;
}

/**
 * Clinics linked to a user outside pure territory membership.
 * Today: active `facility_vertical_rep_assignments` only.
 */
export interface FacilityAssociationPort {
  getAssociatedFacilityIds(
    userId: number,
    verticalIds?: number[],
  ): Promise<number[]>;
}

export interface TerritoryHierarchyPort {
  resolveEffectiveTerritoryIds(
    assignedTerritoryIds: number[],
    activeOnly?: boolean
  ): Promise<number[]>;
}
