import { Role } from "@atlasmed/access";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
}

export class TerritoryAssignmentPolicyService {
  constructor(private readonly deps: Dependencies) {}

  async validateAssignment(params: {
    targetUserId: string;
    targetRole: Role;
    territoryId: string;
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

    if (params.targetRole === Role.REP && !type.assignableToUsers) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "This territory type cannot be assigned to field reps"
      );
    }

    if (params.targetRole === Role.MANAGER && !type.assignableToManagers) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "This territory type cannot be assigned to managers"
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
