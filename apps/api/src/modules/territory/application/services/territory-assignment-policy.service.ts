import { Role } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";
import { isManagerZoneType, isRepPatchType } from "../constants/territory-roles.constants";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  /** Reads the target's asserted vertical membership (UVA) for invariant I6. */
  verticalMembership: {
    findVerticalIdsByUserId(userId: number): Promise<number[]>;
  };
}

export class TerritoryAssignmentPolicyService {
  constructor(private readonly deps: Dependencies) {}

  async validateAssignment(params: {
    targetUserId: number;
    targetRole: Role;
    territoryId: number;
  }): Promise<void> {
    const territory = await this.deps.territoryRepository.findById(params.territoryId);
    if (!territory || !territory.isActive) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "Territory does not exist or is inactive"
      );
    }

    const type =
      territory.territoryType ??
      (await this.deps.territoryTypeRepository.findById(territory.territoryTypeId));
    if (!type) {
      throw new OperationNotAllowedError("assign_territory", "Territory type not found");
    }

    if (params.targetRole !== Role.REP && params.targetRole !== Role.MANAGER) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "Territory assignments are only supported for REP and MANAGER accounts"
      );
    }

    if (params.targetRole === Role.REP && !isRepPatchType(type)) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "Representatives can only be assigned to patch territories"
      );
    }

    if (params.targetRole === Role.MANAGER && !isManagerZoneType(type)) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "Managers can only be assigned to manager zone territories"
      );
    }

    // Invariant I6 (spec 0010 §1.1): a user may hold a territory only in a
    // vertical they are already assigned.
    //
    // This is what makes UVA the single source of truth. Before it, scope
    // resolution unioned the verticals of a user's territories into their
    // membership, so assigning a territory silently granted its vertical
    // everywhere while `GET /user/assignments` kept reporting UVA only —
    // effective access exceeded anything any screen could show (D-29).
    //
    // Enforced here rather than by a database constraint because the check
    // spans three tables and the useful failure is a message naming the
    // vertical, not a constraint violation.
    const assignedVerticalIds =
      await this.deps.verticalMembership.findVerticalIdsByUserId(params.targetUserId);

    if (!assignedVerticalIds.includes(territory.verticalId)) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "User is not assigned to this territory's vertical. Assign the vertical first."
      );
    }

    // Spec 0006: one REP per patch; one MANAGER per zone.
    if (params.targetRole === Role.MANAGER || params.targetRole === Role.REP) {
      const conflictingAssignments =
        await this.deps.territoryRepository.findConflictingAssignments({
          territoryId: params.territoryId,
          excludeUserId: params.targetUserId,
          roles: [params.targetRole],
        });

      if (conflictingAssignments.length > 0) {
        throw new OperationNotAllowedError(
          "assign_territory",
          params.targetRole === Role.MANAGER
            ? "Territory is already assigned to another manager"
            : "Patch is already assigned to another representative",
        );
      }
    }
  }
}
