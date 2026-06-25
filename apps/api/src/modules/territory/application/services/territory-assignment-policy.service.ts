import { Role } from "@atlasmed/access";
import { prisma } from "../../../../infrastructure/database/prisma.client";
import type { TerritoryClosureRepository } from "../interfaces/territory-closure.repository.interface";
import type { TerritoryRepository } from "../interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../interfaces/territory-type.repository.interface";
import { OperationNotAllowedError } from "../../../../shared/errors";

interface Dependencies {
  territoryRepository: TerritoryRepository;
  territoryTypeRepository: TerritoryTypeRepository;
  closureRepository: TerritoryClosureRepository;
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

    if (params.targetRole !== Role.USER && params.targetRole !== Role.MANAGER) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "Territory assignments are only supported for USER and MANAGER accounts"
      );
    }

    if (params.targetRole === Role.USER && !type.assignableToUsers) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "This territory type cannot be assigned to field users"
      );
    }

    if (params.targetRole === Role.MANAGER && !type.assignableToManagers) {
      throw new OperationNotAllowedError(
        "assign_territory",
        "This territory type cannot be assigned to managers"
      );
    }

    const exclusionRoles =
      params.targetRole === Role.MANAGER ? [Role.MANAGER] : [Role.USER];

    const conflictingAssignments = await prisma.userTerritoryAssignment.findMany({
      where: {
        userId: { not: params.targetUserId },
        user: {
          role: { name: { in: exclusionRoles } },
        },
      },
      select: { territoryId: true, userId: true },
    });

    for (const assignment of conflictingAssignments) {
      const overlaps = await this.deps.closureRepository.hasAncestorDescendantRelation(
        assignment.territoryId,
        params.territoryId
      );
      if (overlaps) {
        throw new OperationNotAllowedError(
          "assign_territory",
          "Territory overlaps with an assignment held by another user in the same role group"
        );
      }
    }
  }
}
