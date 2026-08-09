import type { PersonFacilityRoleCatalogRepository } from "../interfaces/person-facility-role-catalog.repository.interface";

type Dependencies = {
  roleCatalogRepository: PersonFacilityRoleCatalogRepository;
};

export class ListPersonFacilityRolesUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute() {
    const roles = await this.deps.roleCatalogRepository.listActive();
    return { data: roles };
  }
}
