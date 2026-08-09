import type { Role } from "../enums/role.enum";

export interface RoleContract {
  id: number;

  name: Role;

  description?: string;
}
