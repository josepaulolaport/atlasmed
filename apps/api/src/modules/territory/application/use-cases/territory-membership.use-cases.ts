import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryMembershipService } from "../services/territory-membership.service";
import type { ClinicMembershipWriter } from "../services/territory-membership.service";
import { isRepPatchType } from "../constants/territory-roles.constants";
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

  /**
   * Spec 0006: clinics in oversight manager zones with no active consultant.
   */
  async listUnassignedFacilities(input: {
    scope: ScopeContext;
    page?: number;
    limit?: number;
    managerZoneId?: number;
  }) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const oversightZoneIds = input.scope.oversightZoneIds ?? [];
    let managerZoneIds: number[] | undefined;
    let global = false;

    if (input.scope.isGlobal) {
      global = true;
      if (input.managerZoneId) {
        managerZoneIds = [input.managerZoneId];
        global = false;
      }
    } else if (oversightZoneIds.length > 0) {
      managerZoneIds = input.managerZoneId
        ? oversightZoneIds.filter((id) => id === input.managerZoneId)
        : oversightZoneIds;
      if (input.managerZoneId && managerZoneIds.length === 0) {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 1 },
        };
      }
    } else {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
      };
    }

    const clinics = await this.deps.clinicWriter.findClinicsWithoutConsultant({
      managerZoneIds,
      global,
    });

    const start = (page - 1) * limit;
    const slice = clinics.slice(start, start + limit);

    return {
      data: slice.map((clinic) => ({
        id: clinic.id,
        displayName: clinic.displayName,
        lat: clinic.lat ?? undefined,
        lng: clinic.lng ?? undefined,
        managerZoneId: clinic.managerZoneId,
        managerZoneName: clinic.managerZoneName ?? undefined,
        territoryId: clinic.managerZoneId,
        territoryAssignmentStatus: "unassigned" as const,
      })),
      pagination: {
        page,
        limit,
        total: clinics.length,
        totalPages: Math.ceil(clinics.length / limit) || 1,
      },
    };
  }

  async adminOverrideClinicTerritory(input: {
    facilityId: number;
    territoryId: number;
    reason?: string;
  }) {
    const territory = await this.deps.territoryRepository.findById(input.territoryId);
    if (!territory?.isActive) {
      throw new ResourceNotFoundError("Territory", input.territoryId);
    }

    const type = territory.territoryType;
    if (!type || !isRepPatchType(type)) {
      throw new OperationNotAllowedError(
        "override_clinic_territory",
        "Clinics can only be assigned to patch territories"
      );
    }

    await this.deps.clinicWriter.setProfileTerritory(
      input.facilityId,
      territory.verticalId,
      input.territoryId,
    );

    return { success: true };
  }
}
