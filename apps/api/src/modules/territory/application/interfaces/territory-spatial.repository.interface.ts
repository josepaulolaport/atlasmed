export interface SiblingOverlapConflict {
  id: number;
  slug: string;
  /** Absolute intersection area. Spec 0009 R3 judges overlap in m², not as a share. */
  overlapSquareMeters: number;
}

export interface OverlappingTerritory {
  id: number;
  slug: string;
}

/**
 * An active rep assignment that a proposed move would invalidate: one of the
 * rep's patches covers the clinic where it stands, and none covers where it is
 * going (spec 0009 R5, invariant I2).
 */
export interface AssignmentLosingCoverage {
  facilityVerticalProfileId: number;
  verticalId: number;
  userId: number;
  userName: string;
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
  slug: string;
  name: string;
}

export interface TerritorySpatialRepository {
  getBoundaryAsGeoJson(territoryId: number): Promise<GeoJsonGeometry | null>;

  /**
   * Boundaries for a set of territories in one query.
   *
   * Listing screens draw every territory at once, so fetching geometry one id at
   * a time turns a list of N into N round trips. Territories with no boundary —
   * a supported state, see `territory_types.can_have_boundary` — are simply
   * absent from the result rather than present as null.
   */
  getBoundariesAsGeoJson(
    territoryIds: number[]
  ): Promise<Map<number, GeoJsonGeometry>>;

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

  /**
   * Spec 0009 R5: the coverage delta for a proposed move. Only assignments that
   * would *become* invalid — an assignment whose rep never covered the clinic is
   * already an override or already broken, and warning about it every time a pin
   * moves is the alert fatigue the requirement calls out.
   */
  findAssignmentsLosingPatchCoverage(input: {
    facilityId: number;
    lat: number;
    lng: number;
  }): Promise<AssignmentLosingCoverage[]>;

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
  }): Promise<Array<{ id: number; slug: string }>>;

  updateBoundaryMetadata(territoryId: number): Promise<void>;
}
