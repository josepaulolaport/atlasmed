export interface ParentOverlapCandidate {
  id: string;
  code: string;
  overlapRatio: number;
}

export interface SiblingOverlapConflict {
  id: string;
  code: string;
  overlapRatio: number;
}

export interface OverlappingTerritory {
  id: string;
  code: string;
}

export interface TerritoryBoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface GeoJsonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface ClinicInReferenceTerritory {
  id: string;
  name: string;
  lat: number;
  lng: number;
  territoryId: string;
  operationalTerritoryCode: string;
  operationalTerritoryName: string;
}

export interface TerritorySpatialRepository {
  getBoundaryAsGeoJson(territoryId: string): Promise<GeoJsonGeometry | null>;

  saveBoundary(
    territoryId: string,
    geoJson: GeoJsonGeometry,
    options?: { repairInvalid?: boolean }
  ): Promise<void>;

  deleteBoundary(territoryId: string): Promise<void>;

  hasBoundary(territoryId: string): Promise<boolean>;

  getBoundaryBoundingBox(territoryId: string): Promise<TerritoryBoundingBox | null>;

  findOverlappingClinicAssignmentTerritories(
    territoryId: string,
    geoJson: GeoJsonGeometry
  ): Promise<OverlappingTerritory[]>;

  findContainingClinicAssignmentTerritoryIds(lng: number, lat: number): Promise<string[]>;

  scoreParentCandidates(input: {
    territoryId: string;
    geoJson: GeoJsonGeometry;
    countryCode: string;
    excludeTerritoryIds: string[];
  }): Promise<ParentOverlapCandidate[]>;

  findOverlappingSiblingTerritories(input: {
    territoryId: string;
    territoryTypeId: string;
    countryCode: string;
    geoJson: GeoJsonGeometry;
  }): Promise<SiblingOverlapConflict[]>;

  updateBoundaryMetadata(territoryId: string): Promise<void>;

  getClippedBoundaryAsGeoJson(
    operationalTerritoryId: string,
    referenceTerritoryId: string
  ): Promise<GeoJsonGeometry | null>;

  findAssignedClinicsInReferenceTerritory(
    referenceTerritoryId: string
  ): Promise<FacilityInReferenceTerritory[]>;
}
