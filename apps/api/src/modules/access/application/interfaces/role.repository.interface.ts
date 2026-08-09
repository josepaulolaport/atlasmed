export interface RoleRecord {
  id: number;
  name: string;
  priority: number;
}

export interface RoleListItem {
  id: number;
  name: string;
  description: string | null;
  priority: number;
}

export interface RoleRepository {
  findById(roleId: number): Promise<RoleRecord | null>;

  findAll(): Promise<RoleListItem[]>;
}
