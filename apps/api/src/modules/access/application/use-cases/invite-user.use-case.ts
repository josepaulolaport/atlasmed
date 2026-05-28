import type { EmailService } from "../interfaces/email.service.interface";
import type { MessagingService } from "../interfaces/messaging.service.interface";
import type { InviteRepository } from "../interfaces/invite.repository.interface";
import type { UserRepository } from "../interfaces/user.repository.interface";
import type { RoleRepository } from "../interfaces/role.repository.interface";
import { InviteService } from "../services/invite.service";
import { 
  ValidationError,
  EmailAlreadyExistsError,
  RoleNotFoundError,
  ResourceConflictError,
  InsufficientPermissionsError,
  UserNotFoundError,
} from "../../../../shared/errors";
import { Role } from "@atlasmed/access";
import { canAssignRole } from "../constants/role-priority.constants";
import type { IAuditLog } from "../interfaces/audit-log.interface";
import type { IMetrics } from "../interfaces/metrics.interface";

interface Dependencies {
  inviteRepository: InviteRepository;
  userRepository: UserRepository;
  roleRepository: RoleRepository;
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
}

export class InviteUserUseCase {
  private readonly inviteService: InviteService;

  constructor(private readonly deps: Dependencies) {
    this.inviteService = new InviteService({ inviteRepository: deps.inviteRepository });
  }

  async execute(params: InviteUserParams) {
    if (!params.email && !params.phoneNumber) {
      throw new ValidationError([
        { field: 'email', message: 'Either email or phone number is required' }
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

    if (inviterRole.name === Role.MANAGER && role.name !== Role.USER) {
      throw new InsufficientPermissionsError(
        [`role:${role.name}`],
        [`role:${Role.MANAGER}`]
      );
    }

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
}
