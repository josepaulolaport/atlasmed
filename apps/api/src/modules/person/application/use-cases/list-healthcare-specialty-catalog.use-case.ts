/**
 * The specialty catalogue, with ids.
 *
 * Distinct from `ListHealthcareSpecialtiesUseCase`, which returns the *names in
 * use* by the doctors we hold — a filter list, deliberately narrowed to what
 * would produce results. Choosing a specialty for a doctor being imported is
 * the opposite question: the answer may be one nobody at that clinic practises
 * yet, and it has to come back as an id because that is what gets written.
 */

export interface HealthcareSpecialtyCatalogEntry {
  id: number;
  name: string;
}

export interface HealthcareSpecialtyCatalogRepository {
  listActive(): Promise<HealthcareSpecialtyCatalogEntry[]>;
}

type Dependencies = {
  specialtyCatalogRepository: HealthcareSpecialtyCatalogRepository;
};

export class ListHealthcareSpecialtyCatalogUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute() {
    return { data: await this.deps.specialtyCatalogRepository.listActive() };
  }
}
