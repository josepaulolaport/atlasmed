export type PersonProfessionalRegistrationRecord = {
  id: number;
  personId: number;
  councilId: number;
  councilAbbreviation: string;
  councilName: string;
  stateCode: string;
  registrationNumber: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePersonProfessionalRegistrationInput = {
  personId: number;
  councilId: number;
  stateCode: string;
  registrationNumber: string;
  isPrimary: boolean;
};

export type UpdatePersonProfessionalRegistrationInput = {
  registrationId: number;
  personId: number;
  councilId?: number;
  stateCode?: string;
  registrationNumber?: string;
  isPrimary?: boolean;
  isActive?: boolean;
};

export interface PersonProfessionalRegistrationRepository {
  findActivePersonById(personId: number): Promise<{ id: number } | null>;

  listByPersonId(
    personId: number,
    options?: { includeInactive?: boolean }
  ): Promise<PersonProfessionalRegistrationRecord[]>;

  findByIdForPerson(
    registrationId: number,
    personId: number
  ): Promise<PersonProfessionalRegistrationRecord | null>;

  create(
    input: CreatePersonProfessionalRegistrationInput
  ): Promise<PersonProfessionalRegistrationRecord>;

  update(
    input: UpdatePersonProfessionalRegistrationInput
  ): Promise<PersonProfessionalRegistrationRecord | null>;

  /** Soft-deactivate; also clears isPrimary when it was primary. */
  deactivate(input: {
    registrationId: number;
    personId: number;
  }): Promise<PersonProfessionalRegistrationRecord | null>;
}
