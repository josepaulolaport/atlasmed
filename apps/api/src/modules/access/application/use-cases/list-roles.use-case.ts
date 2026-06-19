import type { RoleRepository } from "../interfaces/role.repository.interface";

interface Dependencies {
  roleRepository: RoleRepository;
}

export class ListRolesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute() {
    const roles = await this.deps.roleRepository.findAll();

    return {
      roles: roles.map(({ id, name, description }) => ({
        id,
        name,
        description,
      })),
    };
  }
}
