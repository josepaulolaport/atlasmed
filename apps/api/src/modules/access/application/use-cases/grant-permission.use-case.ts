import type { AccessGrantService } from "../services/access-grant.service";
import {
  Role,
  isValidGrantAction,
  isValidGrantResource,
  normalizeGrantResource,
  validateGrantConditions,
  GrantConditionValidationError,
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
    targetUserId: number;
    resource: string;
    /** CRM entity id — stored as decimal text on permissions.resource_id */
    resourceId?: number;
    action: string;
    conditions?: Record<string, unknown>;
    grantedBy: number;
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

    const resource = normalizeGrantResource(params.resource);

    if (!isValidGrantResource(resource)) {
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

    const resourceId =
      params.resourceId === undefined ? null : String(params.resourceId);

    let validatedConditions: Record<string, unknown> | undefined;
    try {
      validatedConditions = validateGrantConditions({
        resource,
        resourceId,
        conditions: params.conditions,
      });
    } catch (error) {
      if (error instanceof GrantConditionValidationError) {
        throw new ValidationError(
          error.issues.map((issue) => ({
            field: issue.field,
            message: issue.message,
          }))
        );
      }
      throw error;
    }

    return await this.deps.accessGrantService.grantPermission({
      userId: params.targetUserId,
      resource,
      resourceId: resourceId ?? undefined,
      action: params.action,
      conditions: validatedConditions,
      grantedBy: params.grantedBy,
      expiresAt: params.expiresAt,
    });
  }
}
