import type { AccessGrantService } from "../services/access-grant.service";
import { Role, normalizeGrantResource } from "@atlasmed/access";
import { InsufficientPermissionsError } from "../../../../shared/errors";

interface Dependencies {
  accessGrantService: AccessGrantService;
}

export class RevokePermissionUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(params: {
    targetUserId: number;
    resource: string;
    resourceId?: number;
    action: string;
    revokedBy: number;
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
      resource: normalizeGrantResource(params.resource),
      resourceId:
        params.resourceId === undefined ? undefined : String(params.resourceId),
      action: params.action,
      revokedBy: params.revokedBy,
    });
  }
}
