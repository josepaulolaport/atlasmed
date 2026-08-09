export interface PersonRecord {
  id: number;
  firstName: string;
  lastName: string;
  socialName: string | null;
  cpf: string | null;
  email: string | null;
  mobilePhone: string | null;
  landlinePhone: string | null;
  birthDate: string | null;
  favoriteTeam: string | null;
  hobbies: string | null;
  languages: string | null;
  imageUrl: string | null;
  facilityIds: number[];
  hasHealthcareProfile: boolean;
}

export interface PatchPersonInput {
  firstName?: string;
  lastName?: string;
  socialName?: string | null;
  cpf?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  landlinePhone?: string | null;
  birthDate?: string | null;
  favoriteTeam?: string | null;
  hobbies?: string | null;
  languages?: string | null;
}

export interface PersonRepository {
  /** Active (non-deleted) person with facilityIds + healthcare flag, or null. */
  findActiveById(personId: number): Promise<PersonRecord | null>;

  update(personId: number, input: PatchPersonInput): Promise<void>;

  /** Distinct active specialty names linked to at least one non-deleted person. */
  listDistinctSpecialtyNames(): Promise<string[]>;
}
