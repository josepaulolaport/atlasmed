import type { TerritoryAssignmentSource } from "@atlasmed/database";
import type {
  ClinicAssignmentTerritoryMatch,
  TerritorySpatialRepository,
} from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";

export interface ClinicMembershipTarget {
  id: string;
  lat: number | null;
  lng: number | null;
  territoryId: string | null;
  territoryAssignmentSource: TerritoryAssignmentSource;
  territoryAssignmentStatus?: "assigned" | "unassigned" | "ambiguous";
}

export interface ClinicMembershipWriter {
  updateProfileTerritoryMemberships(
    facilityId: string,
    memberships: Array<{ verticalId: string; territoryId: string | null }>
  ): Promise<void>;

  updateTerritoryMembership(
    facilityId: string,
    data: {
      territoryAssignmentStatus: "assigned" | "unassigned" | "ambiguous";
      territoryAssignmentSource: TerritoryAssignmentSource;
    }
  ): Promise<void>;

  /** Set one vertical profile's territory without clearing other verticals. */
  setProfileTerritory(
    facilityId: string,
    verticalId: string,
    territoryId: string | null,
  ): Promise<void>;

  findClinicsForMembership(params?: {
    facilityIds?: string[];
    territoryIds?: string[];
    boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  }): Promise<ClinicMembershipTarget[]>;
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
    options?: { excludeTerritoryId?: string; force?: boolean }
  ): Promise<void> {
    if (clinic.territoryAssignmentSource === "manual" && !options?.force) {
      return;
    }

    if (clinic.lat === null || clinic.lng === null) {
      await this.deps.clinicWriter.updateProfileTerritoryMemberships(clinic.id, []);
      await this.deps.clinicWriter.updateTerritoryMembership(clinic.id, {
        territoryAssignmentStatus: "unassigned",
        territoryAssignmentSource: "geo",
      });
      return;
    }

    const matches = await this.deps.spatialRepository.findContainingClinicAssignmentTerritoryIds(
      clinic.lng,
      clinic.lat,
      { excludeTerritoryId: options?.excludeTerritoryId }
    );

    const { singleMatches, hasAmbiguousMatch } = this.resolveVerticalMatches(matches);
    await this.deps.clinicWriter.updateProfileTerritoryMemberships(
      clinic.id,
      singleMatches.map((match) => ({
        verticalId: match.verticalId,
        territoryId: match.id,
      }))
    );

    await this.deps.clinicWriter.updateTerritoryMembership(clinic.id, {
      territoryAssignmentStatus:
        singleMatches.length > 0 ? "assigned" : hasAmbiguousMatch ? "ambiguous" : "unassigned",
      territoryAssignmentSource: "geo",
    });
  }

  /**
   * Clears clinic membership for a territory that is about to be deleted.
   * Re-runs geo matching excluding this territory so clinics land on whatever
   * other active territory covers them (or become unassigned) instead of
   * blocking deletion. Manually-pinned clinics are forced through too — a
   * manual pin to a territory being deleted is no longer a valid override.
   */
  async disassociateClinicsForTerritory(territoryId: string): Promise<{ processed: number }> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership({
      territoryIds: [territoryId],
    });

    for (const clinic of clinics) {
      await this.assignClinicByGeo(clinic, { excludeTerritoryId: territoryId, force: true });
    }

    return { processed: clinics.length };
  }

  async assignFacilityById(facilityId: string): Promise<void> {
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
      const before = clinic.territoryId;
      await this.assignClinicByGeo(clinic);
      const after = (
        await this.deps.clinicWriter.findClinicsForMembership({
          facilityIds: [clinic.id],
        })
      )[0]?.territoryId;
      if (before !== after) {
        updated += 1;
      }
    }

    return { processed: clinics.length, updated };
  }

  async recomputeForTerritoryBoundary(territoryId: string): Promise<{ processed: number }> {
    const clinicsById = new Map<string, ClinicMembershipTarget>();

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
      if (clinic.territoryAssignmentSource === "manual") {
        continue;
      }
      await this.assignClinicByGeo(clinic);
      processed += 1;
    }

    return { processed };
  }

  private resolveVerticalMatches(matches: ClinicAssignmentTerritoryMatch[]): {
    singleMatches: ClinicAssignmentTerritoryMatch[];
    hasAmbiguousMatch: boolean;
  } {
    const matchesByVerticalId = new Map<string, ClinicAssignmentTerritoryMatch[]>();
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
