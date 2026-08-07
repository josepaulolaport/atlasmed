export interface SiblingOverlapConflict {
  id: string;
  code: string;
  overlapRatio: number;
}

export interface OverlappingTerritory {
  id: string;
  code: string;
}

export interface ClinicAssignmentTerritoryMatch {
  id: string;
  verticalId: string;
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
  ): Promise<ClinicAssignmentTerritoryMatch[]>;

  /** Spec 0006: true if user has an active rep patch covering the facility point. */
  userHasRepPatchCoveringFacility(
    userId: string,
    facilityId: string
  ): Promise<boolean>;

  /**
   * Spec 0006 boundary impact: assigned clinics that would lose coverage
   * under the proposed geometry (manager zone leave, or rep loses all patch cover).
   */
  findAssignedClinicsImpactedByBoundary(input: {
    territoryId: string;
    mode: "manager_zone" | "rep_patch";
    geoJson: GeoJsonGeometry;
  }): Promise<
    Array<{
      facilityId: string;
      facilityName: string;
      consultantUserId: string;
      consultantName: string;
    }>
  >;

  findOverlappingSiblingTerritories(input: {
    territoryId: string;
    territoryTypeId: string;
    geoJson: GeoJsonGeometry;
  }): Promise<SiblingOverlapConflict[]>;

  findContainingManagerZones(input: {
    geoJson: GeoJsonGeometry;
    verticalId?: string;
  }): Promise<ManagerZoneCandidate[]>;

  findRepPatchesOutsideManagerZone(input: {
    managerZoneId: string;
    managerZoneGeoJson: GeoJsonGeometry;
  }): Promise<Array<{ id: string; code: string }>>;

  updateBoundaryMetadata(territoryId: string): Promise<void>;
}
