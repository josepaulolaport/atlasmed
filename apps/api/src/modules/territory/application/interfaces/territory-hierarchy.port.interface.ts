export interface TerritoryHierarchyPort {
  resolveDescendantIds(ancestorIds: string[], activeOnly?: boolean): Promise<string[]>;

  findUsersAssignedToTerritoryAncestors(territoryIds: string[]): Promise<string[]>;
}
