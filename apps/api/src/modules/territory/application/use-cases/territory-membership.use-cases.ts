import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryMembershipService } from "../services/territory-membership.service";
import type { ClinicMembershipWriter } from "../services/territory-membership.service";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
} from "../../../../shared/errors";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  membershipService: TerritoryMembershipService;
  clinicWriter: ClinicMembershipWriter;
}

export class TerritoryMembershipUseCases {
  constructor(private readonly deps: Dependencies) {}

  async recomputeMembership() {
    return this.deps.membershipService.recomputeAll();
  }

  async listUnassignedClinics(input: {
    scope: ScopeContext;
    page?: number;
    limit?: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const clinics = await this.deps.clinicWriter.findClinicsForMembership();

    const filtered = clinics.filter((clinic) => {
      if (
        clinic.territoryAssignmentStatus !== "unassigned" &&
        clinic.territoryAssignmentStatus !== "ambiguous"
      ) {
        return false;
      }

      if (input.scope.isGlobal) {
        return true;
      }

      return true;
    });

    const start = (page - 1) * limit;
    const slice = filtered.slice(start, start + limit);

    return {
      data: slice.map((clinic) => ({
        id: clinic.id,
        lat: clinic.lat ?? undefined,
        lng: clinic.lng ?? undefined,
        territoryId: clinic.territoryId ?? undefined,
        territoryAssignmentStatus: clinic.territoryAssignmentStatus,
      })),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit) || 1,
      },
    };
  }

  async adminOverrideClinicTerritory(input: {
    clinicId: string;
    territoryId: string;
    reason?: string;
  }) {
    const territory = await this.deps.territoryRepository.findById(input.territoryId);
    if (!territory?.isActive) {
      throw new ResourceNotFoundError("Territory", input.territoryId);
    }

    const activeChildCount = await this.deps.territoryRepository.countActiveChildren(
      input.territoryId
    );
    if (activeChildCount > 0) {
      throw new OperationNotAllowedError(
        "override_clinic_territory",
        "Clinics can only be assigned to leaf territories"
      );
    }

    await this.deps.clinicWriter.updateTerritoryMembership(input.clinicId, {
      territoryId: input.territoryId,
      territoryAssignmentStatus: "assigned",
      territoryAssignmentSource: "manual",
    });

    return { success: true };
  }

  async unlockClinicGeo(input: { clinicId: string }) {
    const clinics = await this.deps.clinicWriter.findClinicsForMembership({
      clinicIds: [input.clinicId],
    });
    const clinic = clinics[0];
    if (!clinic) {
      throw new ResourceNotFoundError("Clinic", input.clinicId);
    }

    await this.deps.clinicWriter.updateTerritoryMembership(input.clinicId, {
      territoryId: clinic.territoryId,
      territoryAssignmentStatus: clinic.territoryAssignmentStatus,
      territoryAssignmentSource: "geo",
    });

    await this.deps.membershipService.assignClinicByGeo({
      ...clinic,
      territoryAssignmentSource: "geo",
    });

    return { success: true };
  }
}
