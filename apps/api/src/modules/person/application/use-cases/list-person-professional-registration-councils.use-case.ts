import type { PersonProfessionalRegistrationCouncilRepository } from "../interfaces/person-professional-registration-council.repository.interface";

type Dependencies = {
  councilRepository: PersonProfessionalRegistrationCouncilRepository;
};

export class ListPersonProfessionalRegistrationCouncilsUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute() {
    const councils = await this.deps.councilRepository.listActive();
    return { data: councils };
  }
}
