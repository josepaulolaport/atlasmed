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
}
