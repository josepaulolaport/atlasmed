import type { Role } from "@atlasmed/access";
import { canMutateUser, type ScopeContext } from "@atlasmed/access";
import { ForbiddenError } from "../../../../shared/errors";

export function assertCanMutateUser(params: {
  scope: ScopeContext;
  actorId: string;
  actorRole: Role;
  target: { id: string; managerId?: string | null };
  action: string;
}): void {
  if (canMutateUser(params.scope, params.actorId, params.actorRole, params.target)) {
    return;
  }

  throw new ForbiddenError(`You are not allowed to ${params.action} this user`);
}
