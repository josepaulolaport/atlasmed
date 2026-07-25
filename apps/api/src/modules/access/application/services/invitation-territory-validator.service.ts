import { Role } from "@atlasmed/access";
import { db } from "../../../../infrastructure/database/db";
import { userTerritoryAssignments } from "@atlasmed/database";
import { eq } from "drizzle-orm";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { TerritoryRepository } from "../../../territory/application/interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../../../territory/application/interfaces/territory-type.repository.interface";
import {
  ValidationError,
  UserNotFoundError,
  OperationNotAllowedError,
} from "../../../../shared/errors";
import {
  MANAGER_ZONE_TYPE_SLUG,
} from "../../../territory/application/constants/territory-roles.constants";

interface Dependencies {
  userRepository: UserRepository;
  territoryRepository?: TerritoryRepository;
  territoryTypeRepository?: TerritoryTypeRepository;
}

export interface ValidateInvitationTerritoriesParams {
  roleId: string;
  roleName: string;
  managerId?: string;
  managerTerritoryId?: string;
  repTerritoryId?: string;
  verticalAssignments?: Array<{
    verticalId: string;
    managerId?: string;
    territoryIds: string[];
  }>;
}

export class InvitationTerritoryValidatorService {
  constructor(private readonly deps: Dependencies) {}

  async validateInvitationTerritories(
    params: ValidateInvitationTerritoriesParams
  ): Promise<void> {
    const {
      roleName,
      managerId,
      managerTerritoryId,
      repTerritoryId,
      verticalAssignments = [],
    } = params;

    if (verticalAssignments.length > 0) {
      await this.validateVerticalAssignments(roleName, verticalAssignments);
      return;
    }

    switch (roleName) {
      case Role.MANAGER:
        await this.validateManagerInvitation({ managerTerritoryId });
        break;

      case Role.REP:
        await this.validateRepInvitation({
          managerId,
          repTerritoryId,
        });
        break;

      case Role.ADMIN:
      case Role.OPS:
        if (managerId || managerTerritoryId || repTerritoryId) {
          throw new ValidationError([
            {
              field: "role",
              message: `${roleName} role does not support territory or manager assignments`,
            },
          ]);
        }
        break;

      default:
        break;
    }
  }

  private async validateVerticalAssignments(
    roleName: string,
    verticalAssignments: Array<{
      verticalId: string;
      managerId?: string;
      territoryIds: string[];
    }>,
  ): Promise<void> {
    if (roleName === Role.ADMIN || roleName === Role.OPS) {
      throw new ValidationError([
        {
          field: "verticalAssignments",
          message: `${roleName} role does not support territory or manager assignments`,
        },
      ]);
    }

    for (const [index, vertical] of verticalAssignments.entries()) {
      if (vertical.territoryIds.length === 0) {
        throw new ValidationError([
          {
            field: `verticalAssignments.${index}.territoryIds`,
            message: "At least one territory is required per business vertical",
          },
        ]);
      }

      if (roleName === Role.MANAGER) {
        for (const territoryId of vertical.territoryIds) {
          await this.validateManagerInvitation({ managerTerritoryId: territoryId });
        }
        continue;
      }

      if (roleName === Role.REP) {
        if (!vertical.managerId) {
          throw new ValidationError([
            {
              field: `verticalAssignments.${index}.managerId`,
              message: "Manager is required for REP role invitations",
            },
          ]);
        }
        for (const territoryId of vertical.territoryIds) {
          await this.validateRepInvitation({
            managerId: vertical.managerId,
            repTerritoryId: territoryId,
          });
        }
      }
    }
  }

  private async validateManagerInvitation(params: {
    managerTerritoryId?: string;
  }): Promise<void> {
    if (!params.managerTerritoryId) {
      throw new ValidationError([
        {
          field: "managerTerritoryId",
          message: "Manager territory is required for MANAGER role invitations",
        },
      ]);
    }

    if (!this.deps.territoryRepository) {
      return;
    }

    const territory = await this.deps.territoryRepository.findById(
      params.managerTerritoryId
    );

    if (!territory || !territory.isActive) {
      throw new ValidationError([
        {
          field: "managerTerritoryId",
          message: "Territory does not exist or is inactive",
        },
      ]);
    }

    const type =
      territory.territoryType ??
      (this.deps.territoryTypeRepository
        ? await this.deps.territoryTypeRepository.findById(territory.territoryTypeId)
        : null);

    if (!type) {
      throw new ValidationError([
        {
          field: "managerTerritoryId",
          message: "Territory type not found",
        },
      ]);
    }

    if (!type.assignableToManagers) {
      throw new ValidationError([
        {
          field: "managerTerritoryId",
          message: `Territory type "${type.name}" cannot be assigned to managers. Expected manager zone type.`,
        },
      ]);
    }

    if (type.slug !== MANAGER_ZONE_TYPE_SLUG) {
      throw new ValidationError([
        {
          field: "managerTerritoryId",
          message: `Territory must be of type "${MANAGER_ZONE_TYPE_SLUG}"`,
        },
      ]);
    }
  }

  private async validateRepInvitation(params: {
    managerId?: string;
    repTerritoryId?: string;
  }): Promise<void> {
    const errors: Array<{ field: string; message: string }> = [];

    if (!params.managerId) {
      errors.push({
        field: "managerId",
        message: "Manager is required for REP role invitations",
      });
    }

    if (!params.repTerritoryId) {
      errors.push({
        field: "repTerritoryId",
        message: "Rep territory is required for REP role invitations",
      });
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }

    const manager = await this.deps.userRepository.findById(params.managerId!);

    if (!manager) {
      throw new UserNotFoundError(params.managerId!);
    }

    if (manager.role.name !== Role.MANAGER) {
      throw new ValidationError([
        {
          field: "managerId",
          message: "Assigned manager must have MANAGER role",
        },
      ]);
    }

    if (!this.deps.territoryRepository) {
      return;
    }

    const repTerritory = await this.deps.territoryRepository.findById(
      params.repTerritoryId!
    );

    if (!repTerritory || !repTerritory.isActive) {
      throw new ValidationError([
        {
          field: "repTerritoryId",
          message: "Territory does not exist or is inactive",
        },
      ]);
    }

    const repType =
      repTerritory.territoryType ??
      (this.deps.territoryTypeRepository
        ? await this.deps.territoryTypeRepository.findById(repTerritory.territoryTypeId)
        : null);

    if (!repType) {
      throw new ValidationError([
        {
          field: "repTerritoryId",
          message: "Territory type not found",
        },
      ]);
    }

    if (!repType.assignableToUsers) {
      throw new ValidationError([
        {
          field: "repTerritoryId",
          message: `Territory type "${repType.name}" cannot be assigned to reps. Expected patch type.`,
        },
      ]);
    }

    if (!repType.assignsClinics) {
      throw new ValidationError([
        {
          field: "repTerritoryId",
          message: "Rep territory must be a patch type that assigns clinics",
        },
      ]);
    }

    const managerAssignments = await db
      .select({ territoryId: userTerritoryAssignments.territoryId })
      .from(userTerritoryAssignments)
      .where(eq(userTerritoryAssignments.userId, manager.id));

    if (managerAssignments.length === 0) {
      throw new ValidationError([
        {
          field: "managerId",
          message: "Assigned manager has no territory assignments",
        },
      ]);
    }

    const managerTerritoryIds = managerAssignments.map((a) => a.territoryId);

    if (!repTerritory.managerTerritoryId) {
      throw new ValidationError([
        {
          field: "repTerritoryId",
          message:
            "Rep territory has no manager zone assigned. Ensure the territory boundary is set and contained within a manager zone.",
        },
      ]);
    }

    if (!managerTerritoryIds.includes(repTerritory.managerTerritoryId)) {
      throw new OperationNotAllowedError(
        "invite_user",
        `Rep territory must be within one of the manager's assigned territories. The rep territory is in manager zone ${repTerritory.managerTerritoryId}, but the manager is only assigned to: ${managerTerritoryIds.join(", ")}`
      );
    }
  }
}
