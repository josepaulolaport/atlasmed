import type { Role } from "../enums/role.enum";

export interface RoleContract {
  id: string;

  name: Role;

  description?: string;
}
