import { Role, toDateOnlyString, type InviteVerticalAssignmentInput } from "@atlasmed/access";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { RoleRepository } from "../interfaces/role.repository.interface";
import type { InvitationTerritoryValidatorService } from "../services/invitation-territory-validator.service";
import type { TerritoryCrudUseCases } from "../../../territory/application/use-cases/territory-crud.use-cases";
import { normalizeInviteAssignments } from "../utils/invite-assignments.utils";
import {
  InsufficientPermissionsError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  RoleNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import { GetInvitationByIdUseCase } from "./get-invitation-by-id.use-case";

interface Dependencies {
  inviteRepository: InviteRepository;
  userRepository: UserRepository;
  roleRepository: RoleRepository;
  territoryValidator: InvitationTerritoryValidatorService;
  territoryCrud?: TerritoryCrudUseCases;
  getInvitationById: GetInvitationByIdUseCase;
}

export class UpdateInvitationUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    inviteId: number;
    actorUserId: number;
    actorRole: Role;
    email?: string;
    phoneNumber?: string | null;
    roleId?: number;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    verticalAssignments?: InviteVerticalAssignmentInput[];
  }) {
    if (params.actorRole !== Role.ADMIN && params.actorRole !== Role.MANAGER) {
      throw new InsufficientPermissionsError(
        ["invitation:update"],
        [`role:${params.actorRole}`],
      );
    }

    const invite = await this.deps.inviteRepository.findById(params.inviteId);
    if (!invite) {
      throw new ResourceNotFoundError("Invitation", params.inviteId);
    }

    if (invite.status !== "PENDING") {
      throw new OperationNotAllowedError(
        "updateInvitation",
        "Only pending invitations can be edited",
      );
    }

    const roleId = params.roleId ?? invite.roleId;
    const role = await this.deps.roleRepository.findById(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    const email = params.email ?? invite.email ?? undefined;
    const phoneNumber =
      params.phoneNumber !== undefined
        ? params.phoneNumber ?? undefined
        : invite.phoneNumber ?? undefined;

    if (!email && !phoneNumber) {
      throw new ValidationError([
        { field: "email", message: "Either email or phone number is required" },
      ]);
    }

    const shouldReplaceVerticals = params.verticalAssignments !== undefined;
    let assignments = null as ReturnType<typeof normalizeInviteAssignments> | null;

    if (shouldReplaceVerticals) {
      const resolved = await this.resolveNewPatches(
        role.name,
        params.verticalAssignments ?? [],
      );
      assignments = normalizeInviteAssignments({
        roleName: role.name,
        verticalAssignments: resolved,
      });

      await this.deps.territoryValidator.validateInvitationTerritories({
        roleId: role.id,
        roleName: role.name,
        inviterUserId: params.actorUserId,
        inviterRoleName: params.actorRole,
        excludeInvitationId: params.inviteId,
        managerTerritoryId: assignments.managerTerritoryId,
        repTerritoryId: assignments.repTerritoryId,
        verticalAssignments: assignments.verticalAssignments,
      });
    }

    await this.deps.inviteRepository.updatePending({
      inviteId: params.inviteId,
      email,
      phoneNumber: phoneNumber ?? null,
      roleId,
      firstName: params.firstName ?? invite.firstName ?? undefined,
      lastName: params.lastName ?? invite.lastName ?? undefined,
      birthDate:
        params.birthDate !== undefined
          ? new Date(`${toDateOnlyString(params.birthDate)}T00:00:00.000Z`)
          : undefined,
      ...(assignments
        ? {
            managerTerritoryId: assignments.managerTerritoryId ?? null,
            repTerritoryId: assignments.repTerritoryId ?? null,
            verticalAssignments: assignments.verticalAssignments.map((v) => ({
              verticalId: v.verticalId,
              territoryIds: v.territoryIds,
            })),
          }
        : {}),
    });

    return this.deps.getInvitationById.execute({
      inviteId: params.inviteId,
      actorRole: params.actorRole,
    });
  }

  private async resolveNewPatches(
    roleName: string,
    verticalAssignments: InviteVerticalAssignmentInput[],
  ): Promise<InviteVerticalAssignmentInput[]> {
    if (roleName !== Role.REP || verticalAssignments.length === 0) {
      return verticalAssignments.map((v) => ({
        verticalId: v.verticalId,
        territoryIds: [...(v.territoryIds ?? [])],
      }));
    }

    if (!this.deps.territoryCrud) {
      for (const [index, v] of verticalAssignments.entries()) {
        if (v.newPatch) {
          throw new ValidationError([
            {
              field: `verticalAssignments.${index}.newPatch`,
              message: "Patch creation is unavailable",
            },
          ]);
        }
      }
      return verticalAssignments;
    }

    const resolved: InviteVerticalAssignmentInput[] = [];
    for (const [index, vertical] of verticalAssignments.entries()) {
      if (!vertical.newPatch) {
        resolved.push({
          verticalId: vertical.verticalId,
          territoryIds: [...(vertical.territoryIds ?? [])],
        });
        continue;
      }

      const draft = vertical.newPatch;
      const suffix = crypto.randomUUID().slice(0, 8);
      const slugBase =
        draft.slug?.trim() ||
        `patch-${draft.name}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80) ||
        `patch-${suffix}`;

      const created = await this.deps.territoryCrud.createTerritory({
        name: draft.name,
        slug: `${slugBase}-${suffix}`,
        verticalId: vertical.verticalId,
        typeSlug: "patch",
        boundary: draft.boundary as {
          type: "Polygon" | "MultiPolygon";
          coordinates: unknown;
        },
      });

      if (created.managerTerritoryId !== draft.managerZoneId) {
        throw new ValidationError([
          {
            field: `verticalAssignments.${index}.newPatch.managerZoneId`,
            message:
              "Drawn patch must be contained within the selected manager zone",
          },
        ]);
      }

      resolved.push({
        verticalId: vertical.verticalId,
        territoryIds: [created.id],
      });
    }

    return resolved;
  }
}
