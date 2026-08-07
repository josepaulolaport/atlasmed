import { Role } from "@atlasmed/access";
import { db } from "../../../../infrastructure/database/db";
import {
  invitationTerritoryAssignments,
  invitations,
  userTerritoryAssignments,
} from "@atlasmed/database";
import { and, eq, ne } from "drizzle-orm";
import type { TerritoryRepository } from "../../../territory/application/interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../../../territory/application/interfaces/territory-type.repository.interface";
import {
  ValidationError,
  OperationNotAllowedError,
} from "../../../../shared/errors";
import {
  MANAGER_ZONE_TYPE_SLUG,
  isManagerZoneType,
  isRepPatchType,
} from "../../../territory/application/constants/territory-roles.constants";

interface Dependencies {
  territoryRepository?: TerritoryRepository;
  territoryTypeRepository?: TerritoryTypeRepository;
}

export interface ValidateInvitationTerritoriesParams {
  roleId: number;
  roleName: string;
  /** When set, MANAGER inviter may only stage patches under own oversight zones. */
  inviterUserId?: number;
  inviterRoleName?: string;
  /** Exclude this invite when checking pending territory staging (updates). */
  excludeInvitationId?: number;
  managerTerritoryId?: number;
  repTerritoryId?: number;
  verticalAssignments?: Array<{
    verticalId: number;
    territoryIds: number[];
  }>;
}

export class InvitationTerritoryValidatorService {
  constructor(private readonly deps: Dependencies) {}

  async validateInvitationTerritories(
    params: ValidateInvitationTerritoriesParams
  ): Promise<void> {
    const {
      roleName,
      managerTerritoryId,
      repTerritoryId,
      verticalAssignments = [],
    } = params;

    if (verticalAssignments.length > 0) {
      await this.validateVerticalAssignments(params, verticalAssignments);
      return;
    }

    switch (roleName) {
      case Role.MANAGER:
        if (managerTerritoryId) {
          await this.validateManagerZone({
            territoryId: managerTerritoryId,
            field: "managerTerritoryId",
            excludeInvitationId: params.excludeInvitationId,
          });
        }
        break;

      case Role.REP:
        if (repTerritoryId) {
          await this.validateEmptyRepPatch({
            territoryId: repTerritoryId,
            field: "repTerritoryId",
            excludeInvitationId: params.excludeInvitationId,
            inviterUserId: params.inviterUserId,
            inviterRoleName: params.inviterRoleName,
          });
        }
        break;

      case Role.ADMIN:
      case Role.OPS:
        if (managerTerritoryId || repTerritoryId) {
          throw new ValidationError([
            {
              field: "role",
              message: `${roleName} role does not support territory assignments`,
            },
          ]);
        }
        break;

      default:
        break;
    }
  }

  private async validateVerticalAssignments(
    params: ValidateInvitationTerritoriesParams,
    verticalAssignments: Array<{
      verticalId: number;
      territoryIds: number[];
    }>,
  ): Promise<void> {
    const { roleName } = params;

    if (roleName === Role.ADMIN) {
      throw new ValidationError([
        {
          field: "verticalAssignments",
          message: "ADMIN role does not support territory assignments",
        },
      ]);
    }

    if (roleName === Role.OPS) {
      for (const [index, vertical] of verticalAssignments.entries()) {
        if (vertical.territoryIds.length > 0) {
          throw new ValidationError([
            {
              field: `verticalAssignments.${index}`,
              message: "OPS invitations support business verticals only (no territories)",
            },
          ]);
        }
      }
      return;
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
          await this.validateManagerZone({
            territoryId,
            verticalId: vertical.verticalId,
            field: `verticalAssignments.${index}.territoryIds`,
            excludeInvitationId: params.excludeInvitationId,
          });
        }
        continue;
      }

      if (roleName === Role.REP) {
        for (const territoryId of vertical.territoryIds) {
          await this.validateEmptyRepPatch({
            territoryId,
            verticalId: vertical.verticalId,
            field: `verticalAssignments.${index}.territoryIds`,
            excludeInvitationId: params.excludeInvitationId,
            inviterUserId: params.inviterUserId,
            inviterRoleName: params.inviterRoleName,
          });
        }
      }
    }
  }

  private async validateManagerZone(params: {
    territoryId: number;
    verticalId?: number;
    field: string;
    excludeInvitationId?: number;
  }): Promise<void> {
    if (!this.deps.territoryRepository) {
      return;
    }

    const territory = await this.deps.territoryRepository.findById(
      params.territoryId
    );

    if (!territory || !territory.isActive) {
      throw new ValidationError([
        {
          field: params.field,
          message: "Territory does not exist or is inactive",
        },
      ]);
    }

    if (params.verticalId && territory.verticalId !== params.verticalId) {
      throw new ValidationError([
        {
          field: params.field,
          message: "Territory does not belong to the selected business vertical",
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
          field: params.field,
          message: "Territory type not found",
        },
      ]);
    }

    if (!isManagerZoneType(type)) {
      throw new ValidationError([
        {
          field: params.field,
          message: `Territory must be of type "${MANAGER_ZONE_TYPE_SLUG}"`,
        },
      ]);
    }

    await this.assertTerritoryUnassigned(params.territoryId, params.field);
    await this.assertNotStagedOnPendingInvite(
      params.territoryId,
      params.field,
      params.excludeInvitationId,
    );
  }

  private async validateEmptyRepPatch(params: {
    territoryId: number;
    verticalId?: number;
    field: string;
    excludeInvitationId?: number;
    inviterUserId?: number;
    inviterRoleName?: string;
  }): Promise<void> {
    if (!this.deps.territoryRepository) {
      return;
    }

    const repTerritory = await this.deps.territoryRepository.findById(
      params.territoryId
    );

    if (!repTerritory || !repTerritory.isActive) {
      throw new ValidationError([
        {
          field: params.field,
          message: "Territory does not exist or is inactive",
        },
      ]);
    }

    if (params.verticalId && repTerritory.verticalId !== params.verticalId) {
      throw new ValidationError([
        {
          field: params.field,
          message: "Territory does not belong to the selected business vertical",
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
          field: params.field,
          message: "Territory type not found",
        },
      ]);
    }

    if (!isRepPatchType(repType)) {
      throw new ValidationError([
        {
          field: params.field,
          message: "Territory must be a rep patch",
        },
      ]);
    }

    if (!repTerritory.managerTerritoryId) {
      throw new ValidationError([
        {
          field: params.field,
          message:
            "Rep patch has no manager zone. Ensure the boundary is contained within a manager zone.",
        },
      ]);
    }

    const zoneAssigneeCount =
      await this.deps.territoryRepository.countAssignedUsers(
        repTerritory.managerTerritoryId,
      );
    if (zoneAssigneeCount < 1) {
      throw new ValidationError([
        {
          field: params.field,
          message:
            "Manager zone for this patch has no assigned manager. Assign a manager to the zone first.",
        },
      ]);
    }

    if (params.inviterRoleName === Role.MANAGER && params.inviterUserId) {
      const inviterZones = await db
        .select({ territoryId: userTerritoryAssignments.territoryId })
        .from(userTerritoryAssignments)
        .where(eq(userTerritoryAssignments.userId, params.inviterUserId));
      const inviterZoneIds = new Set(inviterZones.map((z) => z.territoryId));
      if (!inviterZoneIds.has(repTerritory.managerTerritoryId)) {
        throw new OperationNotAllowedError(
          "invite_user",
          "Managers may only invite reps into patches under their own zones",
        );
      }
    }

    await this.assertTerritoryUnassigned(params.territoryId, params.field);
    await this.assertNotStagedOnPendingInvite(
      params.territoryId,
      params.field,
      params.excludeInvitationId,
    );
  }

  private async assertTerritoryUnassigned(
    territoryId: number,
    field: string,
  ): Promise<void> {
    if (!this.deps.territoryRepository) return;
    const count =
      await this.deps.territoryRepository.countAssignedUsers(territoryId);
    if (count > 0) {
      throw new ValidationError([
        {
          field,
          message:
            "Territory already has an assigned user. Pick an empty zone/patch (1 user per territory).",
        },
      ]);
    }
  }

  private async assertNotStagedOnPendingInvite(
    territoryId: number,
    field: string,
    excludeInvitationId?: number,
  ): Promise<void> {
    const rows = await db
      .select({
        invitationId: invitationTerritoryAssignments.invitationId,
      })
      .from(invitationTerritoryAssignments)
      .innerJoin(
        invitations,
        eq(invitationTerritoryAssignments.invitationId, invitations.id),
      )
      .where(
        and(
          eq(invitationTerritoryAssignments.territoryId, territoryId),
          eq(invitations.status, "PENDING"),
          excludeInvitationId
            ? ne(invitations.id, excludeInvitationId)
            : undefined,
        ),
      )
      .limit(1);

    if (rows.length > 0) {
      throw new ValidationError([
        {
          field,
          message: "Territory is already staged on another pending invitation",
        },
      ]);
    }
  }
}
