import type {
  TerritoryRollupLinkSource,
  TerritoryRollupRelationshipType,
} from "@atlasmed/database";

export interface TerritoryRollupAncestorRecord {
  id: string;
  name: string;
  code: string;
  slug: string;
  territoryType: {
    slug: string;
    name: string;
  };
}

export interface TerritoryRollupLinkRecord {
  id: string;
  territoryId: string;
  ancestorId: string;
  relationshipType: TerritoryRollupRelationshipType;
  source: TerritoryRollupLinkSource;
  createdAt: Date;
  ancestor?: TerritoryRollupAncestorRecord;
}

export interface TerritoryRollupRepository {
  listByTerritoryId(territoryId: string): Promise<TerritoryRollupLinkRecord[]>;

  findById(id: string): Promise<TerritoryRollupLinkRecord | null>;

  create(input: {
    territoryId: string;
    ancestorId: string;
    relationshipType?: TerritoryRollupRelationshipType;
    source?: TerritoryRollupLinkSource;
  }): Promise<TerritoryRollupLinkRecord>;

  delete(id: string): Promise<void>;

  deleteGeoRollupLinks(territoryId: string): Promise<void>;

  replaceGeoRollupLinks(territoryId: string, ancestorIds: string[]): Promise<void>;
}
