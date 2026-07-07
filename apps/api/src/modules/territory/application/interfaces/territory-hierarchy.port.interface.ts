export interface TerritoryHierarchyPort {
  resolveEffectiveTerritoryIds(
    assignedTerritoryIds: string[],
    activeOnly?: boolean
  ): Promise<string[]>;

  resolveDescendantIds(ancestorIds: string[], activeOnly?: boolean): Promise<string[]>;

  findUsersAssignedToTerritoryAncestors(territoryIds: string[]): Promise<string[]>;
}
