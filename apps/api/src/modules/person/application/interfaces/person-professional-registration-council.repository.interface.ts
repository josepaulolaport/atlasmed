export type PersonProfessionalRegistrationCouncilEntry = {
  id: number;
  name: string;
  abbreviation: string;
  isActive: boolean;
};

export interface PersonProfessionalRegistrationCouncilRepository {
  /** Active catalog rows, stable order by abbreviation. */
  listActive(): Promise<PersonProfessionalRegistrationCouncilEntry[]>;

  findActiveById(
    councilId: number
  ): Promise<PersonProfessionalRegistrationCouncilEntry | null>;
}
