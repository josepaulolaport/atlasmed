export interface RoleRecord {
  id: string;
  name: string;
  priority: number;
}

export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
  priority: number;
}

export interface RoleRepository {
  findById(roleId: string): Promise<RoleRecord | null>;

  findAll(): Promise<RoleListItem[]>;
}
