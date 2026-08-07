import type {
  ClinicAssignmentTerritoryMatch,
  TerritorySpatialRepository,
} from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";

export interface ClinicMembershipTarget {
  id: number;
  lat: number | null;
  lng: number | null;
  managerZoneId: number | null;
}

export interface ClinicMembershipWriter {
  updateProfileTerritoryMemberships(
    facilityId: number,
    memberships: Array<{ verticalId: number; managerZoneId: number | null }>
  ): Promise<void>;

  /** Set one vertical profile's manager zone without clearing other verticals. */
  setProfileTerritory(
    facilityId: number,
    verticalId: number,
    managerZoneId: number | null,
  ): Promise<void>;

  findClinicsForMembership(params?: {
    facilityIds?: number[];
    territoryIds?: number[];
    boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  }): Promise<ClinicMembershipTarget[]>;

  /**
   * Spec 0006: clinics in manager zones with no active primary consultant.
   * When managerZoneIds is omitted/empty and global is true, all zones.
   */
  findClinicsWithoutConsultant(params: {
    managerZoneIds?: number[];
    global: boolean;
  }): Promise<
    Array<{
      id: number;
      displayName: string;
      lat: number | null;
      lng: number | null;
      managerZoneId: number;
      managerZoneName: string | null;
    }>
  >;
}

interface Dependencies {
  spatialRepository: TerritorySpatialRepository;
  territoryRepository: TerritoryRepository;
  clinicWriter: ClinicMembershipWriter;
}

export class TerritoryMembershipService {
  constructor(private readonly deps: Dependencies) {}

  async assignClinicByGeo(
    clinic: ClinicMembershipTarget,
    options?: { excludeTerritoryId?: number; force?: boolean }
  ): Promise<void> {
    if (clinic.lat === null || clinic.lng === null) {
      await this.deps.clinicWriter.updateProfileTerritoryMemberships(clinic.id, []);
      return;
    }

    const matches = await this.deps.spatialRepository.findContainingClinicAssignmentTerritoryIds(
      clinic.lng,
      clinic.lat,
      { excludeTerritoryId: options?.excludeTerritoryId }
    );

    const { singleMatches } = this.resolveVerticalMatches(matches);
    await this.deps.clinicWriter.updateProfileTerritoryMemberships(
      clinic.id,
      singleMatches.map((match) => ({
        verticalId: match.verticalId,
        managerZoneId: match.id,
      }))
    );
  }

  /**
   * Clears clinic membership for a territory that is about to be deleted.
   * Re-runs geo matching excluding this territory so clinics land on whatever
   * other active territory covers them (or become unassigned) instead of
   * blocking deletion.
   */
  async disassociateClinicsForTerritory(territoryId: number): Promise<{ processed: number }> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership({
      territoryIds: [territoryId],
    });

    for (const clinic of clinics) {
      await this.assignClinicByGeo(clinic, { excludeTerritoryId: territoryId, force: true });
    }

    return { processed: clinics.length };
  }

  async assignFacilityById(facilityId: number): Promise<void> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership({
      facilityIds: [facilityId],
    });
    const clinic = clinics[0];
    if (!clinic) {
      return;
    }
    await this.assignClinicByGeo(clinic);
  }

  async recomputeAll(): Promise<{ processed: number; updated: number }> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership();
    let updated = 0;

    for (const clinic of clinics) {
      const before = clinic.managerZoneId;
      await this.assignClinicByGeo(clinic);
      const after = (
        await this.deps.clinicWriter.findClinicsForMembership({
          facilityIds: [clinic.id],
        })
      )[0]?.managerZoneId;
      if (before !== after) {
        updated += 1;
      }
    }

    return { processed: clinics.length, updated };
  }

  async recomputeForTerritoryBoundary(territoryId: number): Promise<{ processed: number }> {
    const clinicsById = new Map<number, ClinicMembershipTarget>();

    const assignedToTerritory = await this.deps.clinicWriter.findClinicsForMembership({
      territoryIds: [territoryId],
    });
    for (const clinic of assignedToTerritory) {
      clinicsById.set(clinic.id, clinic);
    }

    const boundingBox = await this.deps.spatialRepository.getBoundaryBoundingBox(territoryId);
    if (boundingBox) {
      const inBoundingBox = await this.deps.clinicWriter.findClinicsForMembership({
        boundingBox,
      });
      for (const clinic of inBoundingBox) {
        clinicsById.set(clinic.id, clinic);
      }
    }

    let processed = 0;
    for (const clinic of clinicsById.values()) {
      await this.assignClinicByGeo(clinic);
      processed += 1;
    }

    return { processed };
  }

  private resolveVerticalMatches(matches: ClinicAssignmentTerritoryMatch[]): {
    singleMatches: ClinicAssignmentTerritoryMatch[];
    hasAmbiguousMatch: boolean;
  } {
    const matchesByVerticalId = new Map<number, ClinicAssignmentTerritoryMatch[]>();
    for (const match of matches) {
      const verticalMatches = matchesByVerticalId.get(match.verticalId) ?? [];
      verticalMatches.push(match);
      matchesByVerticalId.set(match.verticalId, verticalMatches);
    }

    const singleMatches: ClinicAssignmentTerritoryMatch[] = [];
    let hasAmbiguousMatch = false;
    for (const verticalMatches of matchesByVerticalId.values()) {
      if (verticalMatches.length === 1) {
        singleMatches.push(verticalMatches[0]!);
      } else {
        hasAmbiguousMatch = true;
      }
    }

    return { singleMatches, hasAmbiguousMatch };
  }
}
