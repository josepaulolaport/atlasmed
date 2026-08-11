export interface SiblingOverlapConflict {
  id: number;
  code: string;
  /** Absolute intersection area. Spec 0009 R3 judges overlap in m², not as a share. */
  overlapSquareMeters: number;
}

export interface OverlappingTerritory {
  id: number;
  code: string;
}

export interface ClinicAssignmentTerritoryMatch {
  id: number;
  verticalId: number;
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
  id: number;
  code: string;
  name: string;
}

export interface TerritorySpatialRepository {
  getBoundaryAsGeoJson(territoryId: number): Promise<GeoJsonGeometry | null>;

  saveBoundary(
    territoryId: number,
    geoJson: GeoJsonGeometry,
    options?: { repairInvalid?: boolean }
  ): Promise<void>;

  deleteBoundary(territoryId: number): Promise<void>;

  hasBoundary(territoryId: number): Promise<boolean>;

  getBoundaryBoundingBox(territoryId: number): Promise<TerritoryBoundingBox | null>;

  findOverlappingClinicAssignmentTerritories(
    territoryId: number,
    geoJson: GeoJsonGeometry
  ): Promise<OverlappingTerritory[]>;

  findContainingClinicAssignmentTerritoryIds(
    lng: number,
    lat: number,
    options?: { excludeTerritoryId?: number }
  ): Promise<ClinicAssignmentTerritoryMatch[]>;

  /** Spec 0006: true if user has an active rep patch covering the facility point. */
  userHasRepPatchCoveringFacility(
    userId: number,
    facilityId: number
  ): Promise<boolean>;

  /**
   * Spec 0006 boundary impact: assigned clinics that would lose coverage
   * under the proposed geometry (manager zone leave, or rep loses all patch cover).
   */
  findAssignedClinicsImpactedByBoundary(input: {
    territoryId: number;
    mode: "manager_zone" | "rep_patch";
    geoJson: GeoJsonGeometry;
  }): Promise<
    Array<{
      facilityId: number;
      facilityName: string;
      facilityVerticalProfileId: number;
      consultantUserId: number;
      consultantName: string;
    }>
  >;

  findOverlappingSiblingTerritories(input: {
    territoryId: number;
    territoryTypeId: number;
    geoJson: GeoJsonGeometry;
  }): Promise<SiblingOverlapConflict[]>;

  findContainingManagerZones(input: {
    geoJson: GeoJsonGeometry;
    verticalId?: number;
  }): Promise<ManagerZoneCandidate[]>;

  findRepPatchesOutsideManagerZone(input: {
    managerZoneId: number;
    managerZoneGeoJson: GeoJsonGeometry;
  }): Promise<Array<{ id: number; code: string }>>;

  updateBoundaryMetadata(territoryId: number): Promise<void>;
}
