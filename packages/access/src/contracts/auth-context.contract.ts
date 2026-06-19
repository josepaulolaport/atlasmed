import type { Role } from "../enums/role.enum";

/** Runtime auth principal resolved by the API auth plugin (after JWT + session validation). */
export interface ResolvedAuthContext {
  userId: string;
  sessionId: string;
  roleId: string;
  roleName: Role;
  status: string;
}

/** @deprecated Use ResolvedAuthContext — kept for backward compatibility. */
export interface AuthContext {
  user: { id: string };
  sessionId: string;
}
