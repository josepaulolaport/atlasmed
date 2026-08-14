import type { ScopeContext } from "@atlasmed/access";
import type { TerritoryMembershipService } from "../services/territory-membership.service";
import type { ClinicMembershipWriter } from "../services/territory-membership.service";

interface Dependencies {
  membershipService: TerritoryMembershipService;
  clinicWriter: ClinicMembershipWriter;
  /**
   * Kept for the search reindex on membership change. The admin zone override
   * that also used it is gone (spec 0009 R7).
   */
  onFacilityChanged?: (facilityId: number) => Promise<void>;
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

    const { rows, total } = await this.deps.clinicWriter.findClinicsNeedingRep({
      managerZoneIds,
      global,
      offset: (page - 1) * limit,
      limit,
    });

    return {
      data: rows.map((clinic) => ({
        id: clinic.facilityId,
        facilityVerticalProfileId: clinic.facilityVerticalProfileId,
        verticalId: clinic.verticalId,
        displayName: clinic.displayName,
        lat: clinic.lat ?? undefined,
        lng: clinic.lng ?? undefined,
        // Spec 0009 R4: why this clinic is here, so the client can tell "nobody
        // has been assigned yet" from "two managers both own the ground".
        reason: clinic.reason,
        // Null for both zone-less reasons — an ambiguous clinic genuinely has no
        // zone, and inventing one here would re-hide what R4 exists to surface.
        managerZoneId: clinic.managerZoneId,
        managerZoneName: clinic.managerZoneName ?? undefined,
        candidateZoneIds: clinic.candidateZoneIds,
        territoryId: clinic.managerZoneId,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

}
