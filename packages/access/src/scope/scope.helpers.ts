import type { ScopeContext } from "../contracts/scope-context.contract";
import { Role } from "../enums/role.enum";

export function createGlobalScopeContext(): ScopeContext {
  return {
    isGlobal: true,
    territoryIds: [],
    clinicIds: [],
    managedUserIds: [],
    isOperationallyActive: true,
  };
}

export function createEmptyScopeContext(): ScopeContext {
  return {
    isGlobal: false,
    territoryIds: [],
    clinicIds: [],
    managedUserIds: [],
    isOperationallyActive: false,
  };
}

export function canMutateUser(
  scope: ScopeContext,
  actorId: string,
  actorRole: Role,
  target: { id: string; managerId?: string | null }
): boolean {
  if (actorId === target.id) {
    return false;
  }

  if (scope.isGlobal || actorRole === Role.ADMIN) {
    return true;
  }

  if (actorRole === Role.MANAGER) {
    return target.managerId === actorId;
  }

  return false;
}

export function canChangeUserRole(actorRole: Role): boolean {
  return actorRole === Role.ADMIN;
}
