import type { Role } from "../enums/role.enum";

export interface ScopeContext {
  isGlobal: boolean;
  territoryIds: string[];
  clinicIds: string[];
  managedUserIds: string[];
  isOperationallyActive: boolean;
  grantIds?: string[];
}

export interface ScopeActor {
  userId: string;
  role: Role;
}
