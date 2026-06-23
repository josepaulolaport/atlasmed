export interface GeoJsonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface OverlappingTerritory {
  id: string;
  code: string;
}

export interface TerritorySpatialRepository {
  getBoundaryAsGeoJson(territoryId: string): Promise<GeoJsonGeometry | null>;

  saveBoundary(territoryId: string, geoJson: GeoJsonGeometry): Promise<void>;

  deleteBoundary(territoryId: string): Promise<void>;

  hasBoundary(territoryId: string): Promise<boolean>;

  findOverlappingLeaves(
    territoryId: string,
    geoJson: GeoJsonGeometry
  ): Promise<OverlappingTerritory[]>;

  findContainingLeafTerritoryId(lng: number, lat: number): Promise<string[]>;
}
