export interface TerritoryGeoMembershipRecord {
  id: string;
  operationalTerritoryId: string;
  referenceTerritoryId: string;
  referenceTypeSlug: string;
  overlapRatio: number;
  intersectionAreaSqKm: number;
  computedAt: Date;
  operationalTerritory?: {
    id: string;
    name: string;
    slug: string;
    code: string;
    territoryType: { slug: string; name: string };
  };
  referenceTerritory?: {
    id: string;
    name: string;
    slug: string;
    code: string;
    territoryType: { slug: string; name: string };
  };
}

export interface GeoMembershipCandidate {
  referenceTerritoryId: string;
  referenceTypeSlug: string;
  overlapRatio: number;
  intersectionAreaSqKm: number;
}

export interface TerritoryGeoMembershipRepository {
  deleteForOperationalTerritory(operationalTerritoryId: string): Promise<void>;

  insertRows(
    rows: Array<{
      operationalTerritoryId: string;
      referenceTerritoryId: string;
      referenceTypeSlug: string;
      overlapRatio: number;
      intersectionAreaSqKm: number;
    }>
  ): Promise<void>;

  findOperationalTerritoryIdsByReferenceIds(referenceTerritoryIds: string[]): Promise<string[]>;

  findReferenceTerritoryIdsByOperationalIds(
    operationalTerritoryIds: string[]
  ): Promise<string[]>;

  listByReferenceTerritoryId(referenceTerritoryId: string): Promise<TerritoryGeoMembershipRecord[]>;

  listByOperationalTerritoryId(operationalTerritoryId: string): Promise<TerritoryGeoMembershipRecord[]>;

  computeCandidates(input: {
    operationalTerritoryId: string;
    countryCode: string;
    minOverlapRatio: number;
  }): Promise<GeoMembershipCandidate[]>;
}
