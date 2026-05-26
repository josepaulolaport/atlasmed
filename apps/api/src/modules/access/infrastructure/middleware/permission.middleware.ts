import { Elysia } from "elysia";
import {
  defineAbilitiesForUser,
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

async function assertPermission(
  context: Record<string, unknown>,
  action: Action,
  subject: Subject,
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

  const ability = defineAbilitiesForUser(user.role.name, grants);

  if (!ability.can(action, subject)) {
    throw new ForbiddenError();
  }
}

/**
 * Enforces CASL permissions on routes that also use the auth plugin.
 *
 * Must use `{ as: 'scoped' }` so the hook runs on the parent route instance
 * (e.g. `.use(auth).use(requirePermission(...)).get(...)`) and can read
 * scoped values like `getUser` and `getAccessGrants` from auth.
 */
export const requirePermission = (action: Action, subject: Subject) => {
  const pluginId = ++permissionPluginSeq;

  return new Elysia({
    name: `permission:${action}:${subject}:${pluginId}`,
  }).onBeforeHandle({ as: "scoped" }, async (context) => {
    await assertPermission(context, action, subject);
  });
};
