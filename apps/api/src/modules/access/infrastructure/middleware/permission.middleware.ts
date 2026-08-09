import { Elysia } from "elysia";
import {
  canAccessResource,
  canAccessRoute,
  type Action,
  type Role,
  type Subject,
} from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";
import { parseRouteId } from "../../../../shared/utils/crm-id";

let permissionPluginSeq = 0;

type PermissionContextUser = {
  role: { name: Role };
};

type GetUserFn = () => Promise<PermissionContextUser>;

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

  const resourceIdParam = options?.resourceIdParam;
  const params = context.params as Record<string, string | number> | undefined;
  const rawResourceId = resourceIdParam
    ? params?.[resourceIdParam]
    : undefined;

  // onBeforeHandle may see path params before or after Elysia coercion
  if (resourceIdParam && rawResourceId !== undefined && rawResourceId !== "") {
    const allowed = canAccessResource(
      user.role.name,
      action,
      subject,
      parseRouteId(String(rawResourceId), resourceIdParam)
    );

    if (!allowed) {
      throw new ForbiddenError();
    }

    return;
  }

  if (!canAccessRoute(user.role.name, action, subject)) {
    throw new ForbiddenError();
  }
}

/**
 * Enforces CASL permissions on routes that also use the auth plugin.
 *
 * Role-based only (AccessGrants removed). `resourceIdParam` still scopes
 * the check call site for clarity / future instance rules; today it uses
 * the same role ability as type-level routes.
 *
 * Must use `{ as: 'scoped' }` so the hook runs on the parent route instance
 * (e.g. `.use(auth).use(requirePermission(...)).get(...)`) and can read
 * scoped values like `getUser` from auth.
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
