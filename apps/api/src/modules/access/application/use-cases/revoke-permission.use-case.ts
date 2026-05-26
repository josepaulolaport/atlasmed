import type { AccessGrantService } from "../services/access-grant.service";
import { Role } from "@atlasmed/access";
import { InsufficientPermissionsError } from "../../../../shared/errors";

interface Dependencies {
  accessGrantService: AccessGrantService;
}

export class RevokePermissionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    targetUserId: string;
    resource: string;
    resourceId?: string;
    action: string;
    revokedBy: string;
    actorRole: Role;
  }) {
    if (params.actorRole !== Role.ADMIN) {
      throw new InsufficientPermissionsError(
        ["permission:revoke"],
        [`role:${params.actorRole}`]
      );
    }

    await this.deps.accessGrantService.revokePermission({
      userId: params.targetUserId,
      resource: params.resource,
      resourceId: params.resourceId,
      action: params.action,
      revokedBy: params.revokedBy,
    });
  }
}
