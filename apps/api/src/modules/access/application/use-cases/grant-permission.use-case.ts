import type { AccessGrantService } from "../services/access-grant.service";
import {
  Role,
  isValidGrantAction,
  isValidGrantResource,
} from "@atlasmed/access";
import {
  InsufficientPermissionsError,
  UserNotFoundError,
  ValidationError,
} from "../../../../shared/errors";
import type { UserRepository } from "../interfaces/user.repository.interface";

interface Dependencies {
  accessGrantService: AccessGrantService;
  userRepository: UserRepository;
}

export class GrantPermissionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    targetUserId: string;
    resource: string;
    resourceId?: string;
    action: string;
    grantedBy: string;
    actorRole: Role;
    expiresAt?: Date;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["permission:grant"],
        [`role:${params.actorRole}`]
      );
    }

    const target = await this.deps.userRepository.findById(params.targetUserId);

    if (!target) {
      throw new UserNotFoundError(params.targetUserId);
    }

    if (!isValidGrantResource(params.resource)) {
      throw new ValidationError([
        {
          field: "resource",
          message: `Invalid grant resource: ${params.resource}`,
        },
      ]);
    }

    if (!isValidGrantAction(params.action)) {
      throw new ValidationError([
        {
          field: "action",
          message: `Invalid grant action: ${params.action}`,
        },
      ]);
    }

    return await this.deps.accessGrantService.grantPermission({
      userId: params.targetUserId,
      resource: params.resource,
      resourceId: params.resourceId,
      action: params.action,
      grantedBy: params.grantedBy,
      expiresAt: params.expiresAt,
    });
  }
}
