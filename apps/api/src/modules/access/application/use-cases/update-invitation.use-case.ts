import { Role, toDateOnlyString } from "@atlasmed/access";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { RoleRepository } from "../interfaces/role.repository.interface";
import type { InvitationTerritoryValidatorService } from "../services/invitation-territory-validator.service";
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
  getInvitationById: GetInvitationByIdUseCase;
}

export class UpdateInvitationUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    inviteId: string;
    actorRole: Role;
    email?: string;
    phoneNumber?: string | null;
    roleId?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    managerId?: string;
    managerTerritoryId?: string;
    repTerritoryId?: string;
    sectorAssignments?: Array<{
      sectorId: string;
      managerId?: string;
      territoryIds: string[];
    }>;
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

    const shouldReplaceSectors = params.sectorAssignments !== undefined;
    const assignments = shouldReplaceSectors
      ? normalizeInviteAssignments({
          roleName: role.name,
          managerId: params.managerId ?? invite.managerId ?? undefined,
          managerTerritoryId:
            params.managerTerritoryId ?? invite.managerTerritoryId ?? undefined,
          repTerritoryId:
            params.repTerritoryId ?? invite.repTerritoryId ?? undefined,
          sectorAssignments: params.sectorAssignments,
        })
      : null;

    if (assignments) {
      await this.deps.territoryValidator.validateInvitationTerritories({
        roleId: role.id,
        roleName: role.name,
        managerId: assignments.managerId,
        managerTerritoryId: assignments.managerTerritoryId,
        repTerritoryId: assignments.repTerritoryId,
        sectorAssignments: assignments.sectorAssignments,
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
            managerId: assignments.managerId ?? null,
            managerTerritoryId: assignments.managerTerritoryId ?? null,
            repTerritoryId: assignments.repTerritoryId ?? null,
            sectorAssignments: assignments.sectorAssignments,
          }
        : {}),
    });

    return this.deps.getInvitationById.execute({
      inviteId: params.inviteId,
      actorRole: params.actorRole,
    });
  }
}
