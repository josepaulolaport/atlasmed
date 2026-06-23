import type { TerritoryAssignmentSource } from "@atlasmed/database";
import type { TerritorySpatialRepository } from "../interfaces/territory-spatial.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";

export interface ClinicMembershipTarget {
  id: string;
  lat: number | null;
  lng: number | null;
  territoryId: string | null;
  territoryAssignmentSource: TerritoryAssignmentSource;
}

export interface ClinicMembershipWriter {
  updateTerritoryMembership(
    clinicId: string,
    data: {
      territoryId: string | null;
      territoryAssignmentStatus: "assigned" | "unassigned" | "ambiguous";
      territoryAssignmentSource: TerritoryAssignmentSource;
    }
  ): Promise<void>;

  findClinicsForMembership(params?: {
    clinicIds?: string[];
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

  async assignClinicByGeo(clinic: ClinicMembershipTarget): Promise<void> {
    if (clinic.territoryAssignmentSource === "manual") {
      return;
    }

    if (clinic.lat === null || clinic.lng === null) {
      await this.deps.clinicWriter.updateTerritoryMembership(clinic.id, {
        territoryId: null,
        territoryAssignmentStatus: "unassigned",
        territoryAssignmentSource: "geo",
      });
      return;
    }

    const matches = await this.deps.spatialRepository.findContainingLeafTerritoryId(
      clinic.lng,
      clinic.lat
    );

    if (matches.length === 1) {
      await this.deps.clinicWriter.updateTerritoryMembership(clinic.id, {
        territoryId: matches[0]!,
        territoryAssignmentStatus: "assigned",
        territoryAssignmentSource: "geo",
      });
      return;
    }

    await this.deps.clinicWriter.updateTerritoryMembership(clinic.id, {
      territoryId: null,
      territoryAssignmentStatus: matches.length > 1 ? "ambiguous" : "unassigned",
      territoryAssignmentSource: "geo",
    });
  }

  async recomputeAll(): Promise<{ processed: number; updated: number }> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership();
    let updated = 0;

    for (const clinic of clinics) {
      const before = clinic.territoryId;
      await this.assignClinicByGeo(clinic);
      const after = (
        await this.deps.clinicWriter.findClinicsForMembership({
          clinicIds: [clinic.id],
        })
      )[0]?.territoryId;
      if (before !== after) {
        updated += 1;
      }
    }

    return { processed: clinics.length, updated };
  }

  async recomputeForTerritoryBoundary(territoryId: string): Promise<{ processed: number }> {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership();
    let processed = 0;

    for (const clinic of clinics) {
      if (clinic.territoryAssignmentSource === "manual") {
        continue;
      }
      await this.assignClinicByGeo(clinic);
      processed += 1;
    }

    return { processed };
  }
}
