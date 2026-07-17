export interface TerritoryHierarchyPort {
  resolveEffectiveTerritoryIds(
    assignedTerritoryIds: string[],
    activeOnly?: boolean
  ): Promise<string[]>;

  findUsersAssignedToRelatedTerritories(territoryIds: string[]): Promise<string[]>;
}
