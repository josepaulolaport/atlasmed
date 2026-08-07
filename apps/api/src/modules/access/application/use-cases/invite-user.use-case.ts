import type { EmailService } from "../interfaces/email.service.interface";
import type { MessagingService } from "../interfaces/messaging.service.interface";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { RoleRepository } from "../interfaces/role.repository.interface";
import { InviteService } from "../services/invite.service";
import { InvitationTerritoryValidatorService } from "../services/invitation-territory-validator.service";
import type { TerritoryRepository } from "../../../territory/application/interfaces/territory.repository.interface";
import type { TerritoryTypeRepository } from "../../../territory/application/interfaces/territory-type.repository.interface";
import type { TerritoryCrudUseCases } from "../../../territory/application/use-cases/territory-crud.use-cases";
import {
  ValidationError,
  EmailAlreadyExistsError,
  RoleNotFoundError,
  ResourceConflictError,
  InsufficientPermissionsError,
  UserNotFoundError,
} from "../../../../shared/errors";
import {
  Role,
  toDateOnlyString,
  type InviteVerticalAssignmentInput,
} from "@atlasmed/access";
import { canAssignRole } from "../constants/role-priority.constants";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import type { IMetrics } from "../interfaces/metrics.interface";
import { tracer } from "../../../../infrastructure/tracing/tracer";
import { normalizeInviteAssignments } from "../utils/invite-assignments.utils";

interface Dependencies {
  inviteRepository: InviteRepository;
  userRepository: UserRepository;
  roleRepository: RoleRepository;
  territoryRepository?: TerritoryRepository;
  territoryTypeRepository?: TerritoryTypeRepository;
  territoryCrud?: TerritoryCrudUseCases;
  emailService?: EmailService;
  messagingService?: MessagingService;
  auditLog: IAuditLog;
  metrics: IMetrics;
}

interface InviteUserParams {
  email?: string | undefined;
  phoneNumber?: string | undefined;
  roleId: string;
  invitedByUserId: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  birthDate: string;
  verticalAssignments?: InviteVerticalAssignmentInput[];
}

export class InviteUserUseCase {
  private readonly inviteService: InviteService;
  private readonly territoryValidator: InvitationTerritoryValidatorService;

  constructor(private readonly deps: Dependencies) {
    this.inviteService = new InviteService({ inviteRepository: deps.inviteRepository });
    this.territoryValidator = new InvitationTerritoryValidatorService({
      territoryRepository: deps.territoryRepository,
      territoryTypeRepository: deps.territoryTypeRepository,
    });
  }

  async execute(params: InviteUserParams) {
    return tracer.with(
      "user.invite",
      async () => this.executeInvite(params),
      { "user.id": params.invitedByUserId, "app.module": "access" }
    );
  }

  private async executeInvite(params: InviteUserParams) {
    if (!params.email && !params.phoneNumber) {
      throw new ValidationError([
        { field: "email", message: "Either email or phone number is required" },
      ]);
    }

    const role = await this.deps.roleRepository.findById(params.roleId);

    if (!role) {
      throw new RoleNotFoundError(params.roleId);
    }

    const inviter = await this.deps.userRepository.findById(params.invitedByUserId);

    if (!inviter) {
      throw new UserNotFoundError(params.invitedByUserId);
    }

    const inviterRole = inviter.role as
      | { name: string; priority?: number | null }
      | undefined;

    if (!inviterRole?.name || !canAssignRole(inviterRole, role)) {
      throw new InsufficientPermissionsError(
        [`role:${role.name}`],
        [`role:${inviterRole?.name ?? "unknown"}`]
      );
    }

    if (inviterRole.name === Role.MANAGER && role.name !== Role.REP) {
      throw new InsufficientPermissionsError(
        [`role:${role.name}`],
        [`role:${Role.MANAGER}`]
      );
    }

    const resolvedVerticals = await this.resolveNewPatches(
      role.name,
      params.verticalAssignments ?? [],
    );

    const assignments = normalizeInviteAssignments({
      roleName: role.name,
      verticalAssignments: resolvedVerticals,
    });

    await this.territoryValidator.validateInvitationTerritories({
      roleId: params.roleId,
      roleName: role.name,
      inviterUserId: params.invitedByUserId,
      inviterRoleName: inviterRole.name,
      managerTerritoryId: assignments.managerTerritoryId,
      repTerritoryId: assignments.repTerritoryId,
      verticalAssignments: assignments.verticalAssignments,
    });

    const identifier = params.email || params.phoneNumber!;
    const existingUser = await this.deps.userRepository.findByIdentifier({ identifier });

    if (existingUser && params.email) {
      throw new EmailAlreadyExistsError(params.email);
    } else if (existingUser) {
      throw new ResourceConflictError("User", "User already exists with this phone number");
    }

    const existingInvite = await this.deps.inviteRepository.findByEmailOrPhone(
      params.email || undefined,
      params.phoneNumber || undefined
    );

    if (existingInvite) {
      throw new ResourceConflictError(
        "Invitation",
        "A pending invitation already exists for this user"
      );
    }

    const { invite, token } = await this.inviteService.createInvite({
      email: params.email || undefined,
      phoneNumber: params.phoneNumber || undefined,
      roleId: params.roleId,
      invitedByUserId: params.invitedByUserId,
      firstName: params.firstName,
      lastName: params.lastName,
      birthDate: new Date(`${toDateOnlyString(params.birthDate)}T00:00:00.000Z`),
      managerTerritoryId: assignments.managerTerritoryId,
      repTerritoryId: assignments.repTerritoryId,
      verticalAssignments: assignments.verticalAssignments.map((v) => ({
        verticalId: v.verticalId,
        territoryIds: v.territoryIds,
      })),
    });

    await this.deps.auditLog.logInviteUser({
      invitedByUserId: params.invitedByUserId,
      inviteId: invite.id,
      email: params.email,
      phoneNumber: params.phoneNumber,
      roleId: params.roleId,
    });

    this.deps.metrics.recordInvite(
      params.email ? "email" : "phone",
      "create"
    );

    return {
      invite,
      token,
    };
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
      const slug =
        draft.slug?.trim() ||
        `patch-${draft.name}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80) ||
        `patch-${suffix}`;

      try {
        const created = await this.deps.territoryCrud.createTerritory({
          name: draft.name,
          slug: `${slug}-${suffix}`,
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
      } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw error;
      }
    }

    return resolved;
  }
}
