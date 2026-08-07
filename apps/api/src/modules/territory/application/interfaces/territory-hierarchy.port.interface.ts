export interface TerritoryHierarchyPort {
  resolveEffectiveTerritoryIds(
    assignedTerritoryIds: number[],
    activeOnly?: boolean
  ): Promise<number[]>;

  findUsersAssignedToRelatedTerritories(territoryIds: number[]): Promise<number[]>;
}
