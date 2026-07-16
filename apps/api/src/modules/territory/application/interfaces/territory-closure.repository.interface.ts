export interface TerritoryClosureRepository {
  deleteForDescendants(descendantIds: string[]): Promise<void>;

  insertRows(
    rows: Array<{ ancestorId: string; descendantId: string; depth: number }>
  ): Promise<void>;

  findDescendantIds(ancestorIds: string[], activeOnly?: boolean): Promise<string[]>;

  findAncestorIds(descendantIds: string[]): Promise<string[]>;

  hasAncestorDescendantRelation(
    territoryIdA: string,
    territoryIdB: string
  ): Promise<boolean>;

  /**
   * Batched form of [hasAncestorDescendantRelation] — checks whether
   * [territoryId] is an ancestor, descendant, or exact match of *any* of
   * [otherTerritoryIds] in a single round trip, instead of one call per
   * candidate.
   */
  hasAnyAncestorDescendantRelation(
    territoryId: string,
    otherTerritoryIds: string[]
  ): Promise<boolean>;
}
