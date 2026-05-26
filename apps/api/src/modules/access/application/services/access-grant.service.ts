import type { AccessGrantRecord } from "@atlasmed/access";
import type { AccessGrantRepository } from "../interfaces/access-grant.repository.interface";
import type { AccessGrantCacheService } from "../../infrastructure/cache/access-grant-cache.service";
import { auditLogService } from "../../../../infrastructure/audit/audit-log.service";

export interface GrantPermissionParams {
  userId: string;
  resource: string;
  resourceId?: string;
  action: string;
  conditions?: Record<string, unknown>;
  grantedBy: string;
  expiresAt?: Date;
}

export class AccessGrantService {
  constructor(
    private readonly deps: {
      accessGrantRepository: AccessGrantRepository;
      accessGrantCache: AccessGrantCacheService;
    }
  ) {}

  async getActiveGrants(userId: string): Promise<AccessGrantRecord[]> {
    const cached = await this.deps.accessGrantCache.get(userId);

    if (cached) {
      return cached;
    }

    const grants = await this.deps.accessGrantRepository.findActiveByUserId(userId);
    await this.deps.accessGrantCache.set(userId, grants);
    return grants;
  }

  async grantPermission(params: GrantPermissionParams): Promise<AccessGrantRecord> {
    const grant = await this.deps.accessGrantRepository.create(params);
    await this.deps.accessGrantCache.invalidate(params.userId);

    await auditLogService.log({
      userId: params.grantedBy,
      eventType: "PERMISSION_GRANT",
      severity: "WARNING",
      action: "grant_permission",
      resource: "permission",
      actorId: params.grantedBy,
      details: {
        targetUserId: params.userId,
        resource: params.resource,
        resourceId: params.resourceId,
        action: params.action,
      },
    });

    return grant;
  }

  async revokePermission(params: {
    userId: string;
    resource: string;
    resourceId?: string;
    action: string;
    revokedBy: string;
  }): Promise<void> {
    await this.deps.accessGrantRepository.deleteMany({
      userId: params.userId,
      resource: params.resource,
      resourceId: params.resourceId,
      action: params.action,
    });

    await this.deps.accessGrantCache.invalidate(params.userId);

    await auditLogService.log({
      userId: params.revokedBy,
      eventType: "PERMISSION_REVOKE",
      severity: "WARNING",
      action: "revoke_permission",
      resource: "permission",
      actorId: params.revokedBy,
      details: {
        targetUserId: params.userId,
        resource: params.resource,
        resourceId: params.resourceId,
        action: params.action,
      },
    });
  }

  async cleanupExpiredPermissions(): Promise<number> {
    return await this.deps.accessGrantRepository.deleteExpired();
  }
}
