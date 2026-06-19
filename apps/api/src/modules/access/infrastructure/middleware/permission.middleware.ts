import { Elysia } from "elysia";
import {
  canAccessResource,
  canAccessRoute,
  type Action,
  type Role,
  type Subject,
  type AccessGrantRecord,
} from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";

let permissionPluginSeq = 0;

type PermissionContextUser = {
  role: { name: Role };
};

type GetUserFn = () => Promise<PermissionContextUser>;
type GetAccessGrantsFn = () => Promise<AccessGrantRecord[]>;

type PermissionOptions = {
  /** Elysia param name containing the resource id (e.g. "id"). */
  resourceIdParam?: string;
};

async function assertPermission(
  context: Record<string, unknown>,
  action: Action,
  subject: Subject,
  options?: PermissionOptions
): Promise<void> {
  const getUser = context.getUser;

  if (typeof getUser !== "function") {
    throw new ForbiddenError();
  }

  const user = await (getUser as GetUserFn)();

  let grants: AccessGrantRecord[] = [];
  const getAccessGrants = context.getAccessGrants;
  if (typeof getAccessGrants === "function") {
    grants = await (getAccessGrants as GetAccessGrantsFn)();
  }

  const resourceIdParam = options?.resourceIdParam;
  const params = context.params as Record<string, string> | undefined;

  if (resourceIdParam && params?.[resourceIdParam]) {
    const allowed = canAccessResource(
      user.role.name,
      grants,
      action,
      subject,
      params[resourceIdParam]
    );

    if (!allowed) {
      throw new ForbiddenError();
    }

    return;
  }

  if (!canAccessRoute(user.role.name, grants, action, subject)) {
    throw new ForbiddenError();
  }
}

/**
 * Enforces CASL permissions on routes that also use the auth plugin.
 *
 * Resource-scoped grants only apply when `resourceIdParam` is set.
 * Type-level routes ignore scoped grants (prevents grant escalation).
 *
 * Must use `{ as: 'scoped' }` so the hook runs on the parent route instance
 * (e.g. `.use(auth).use(requirePermission(...)).get(...)`) and can read
 * scoped values like `getUser` and `getAccessGrants` from auth.
 */
export const requirePermission = (
  action: Action,
  subject: Subject,
  options?: PermissionOptions
) => {
  const pluginId = ++permissionPluginSeq;
  const resourceSuffix = options?.resourceIdParam
    ? `:res:${options.resourceIdParam}`
    : "";

  return new Elysia({
    name: `permission:${action}:${subject}${resourceSuffix}:${pluginId}`,
  }).onBeforeHandle({ as: "scoped" }, async (context) => {
    await assertPermission(context, action, subject, options);
  });
};
