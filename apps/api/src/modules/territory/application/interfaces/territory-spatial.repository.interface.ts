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

export interface ManagerZoneCandidate {
  id: string;
  code: string;
  name: string;
}

export interface FacilityInGroupingTerritory {
  id: string;
  name: string;
  lat: number;
  lng: number;
  territoryId: string;
  repPatchCode: string;
  repPatchName: string;
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

  findContainingClinicAssignmentTerritoryIds(
    lng: number,
    lat: number,
    options?: { excludeTerritoryId?: string }
  ): Promise<string[]>;

  findOverlappingSiblingTerritories(input: {
    territoryId: string;
    territoryTypeId: string;
    countryCode: string;
    geoJson: GeoJsonGeometry;
  }): Promise<SiblingOverlapConflict[]>;

  findContainingManagerZones(input: {
    geoJson: GeoJsonGeometry;
    countryCode: string;
  }): Promise<ManagerZoneCandidate[]>;

  findRepPatchesOutsideManagerZone(input: {
    managerZoneId: string;
    managerZoneGeoJson: GeoJsonGeometry;
  }): Promise<Array<{ id: string; code: string }>>;

  updateBoundaryMetadata(territoryId: string): Promise<void>;

  findAssignedClinicsInGroupingTerritory(input: {
    groupingTerritoryId: string;
    scopedPatchIds: string[];
  }): Promise<FacilityInGroupingTerritory[]>;
}
