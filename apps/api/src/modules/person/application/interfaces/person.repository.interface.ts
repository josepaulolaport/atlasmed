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
  /** Same active links as `facilityIds`, named, ordered by name. */
  facilities: PersonFacilitySummary[];
  hasHealthcareProfile: boolean;
}

export interface PersonFacilitySummary {
  id: number;
  name: string;
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
  /** Active (non-deleted) person with their clinics + healthcare flag, or null. */
  findActiveById(personId: number): Promise<PersonRecord | null>;

  update(personId: number, input: PatchPersonInput): Promise<void>;

  /** Distinct active specialty names linked to at least one non-deleted person. */
  listDistinctSpecialtyNames(): Promise<string[]>;

  /** Set a doctor's specialties to exactly this list, at most one primary. */
  replaceSpecialties(input: {
    personId: number;
    specialties: { id: number; isPrimary: boolean }[];
  }): Promise<{ id: number; name: string; isPrimary: boolean }[]>;
}
