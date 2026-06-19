import { Role } from "@atlasmed/access";

/** Higher value = higher privilege. Used in seed and role assignment checks. */
export const ROLE_PRIORITY_BY_NAME = {
  [Role.ADMIN]: 100,
  [Role.MANAGER]: 50,
  [Role.USER]: 10,
} as const satisfies Record<Role, number>;

export function resolveRolePriority(role: {
  name: string;
  priority?: number | null;
}): number {
  if (role.priority != null && role.priority > 0) {
    return role.priority;
  }
  return ROLE_PRIORITY_BY_NAME[role.name as Role] ?? 0;
}

export function canAssignRole(
  inviterRole: { name: string; priority?: number | null },
  targetRole: { name: string; priority?: number | null }
): boolean {
  return (
    resolveRolePriority(targetRole) <= resolveRolePriority(inviterRole)
  );
}
