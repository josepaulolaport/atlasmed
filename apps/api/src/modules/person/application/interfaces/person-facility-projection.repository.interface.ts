export const CLASSIFICATION = {
  HEALTHCARE_PROFESSIONAL: "HEALTHCARE_PROFESSIONAL",
  ADMINISTRATIVE_CONTACT: "ADMINISTRATIVE_CONTACT",
} as const;

export type ClassificationCode = (typeof CLASSIFICATION)[keyof typeof CLASSIFICATION];

export type PersonFacilityProjectionRecord = {
  personFacilityId: number;
  personId: number;
  facilityId: number;
  firstName: string;
  lastName: string;
  socialName: string | null;
  cpf: string | null;
  email: string | null;
  mobilePhone: string | null;
  landlinePhone: string | null;
  roleTitle: string | null;
  notes: string | null;
  hasHealthcareProfile: boolean;
  classificationCodes: string[];
  roleCodes: string[];
  endedAt: Date | null;
};

export type CreatePersonInput = {
  firstName: string;
  lastName: string;
  socialName?: string | null;
  cpf?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  landlinePhone?: string | null;
};

export type UpdatePersonInput = {
  firstName?: string;
  lastName?: string;
  socialName?: string | null;
  cpf?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  landlinePhone?: string | null;
};

export type UpdateAffiliationInput = {
  roleTitle?: string | null;
  notes?: string | null;
};

export interface PersonFacilityProjectionRepository {
  listActiveByFacilityAndClassification(input: {
    facilityId: number;
    classificationCode: ClassificationCode;
  }): Promise<PersonFacilityProjectionRecord[]>;

  findActiveById(personFacilityId: number): Promise<PersonFacilityProjectionRecord | null>;

  findActiveAffiliation(input: {
    facilityId: number;
    personId: number;
  }): Promise<{ id: number; facilityId: number; personId: number } | null>;

  findPersonById(personId: number): Promise<{ id: number; deletedAt: Date | null } | null>;

  createPerson(input: CreatePersonInput): Promise<{ id: number }>;

  ensureHealthcareProfile(personId: number): Promise<void>;

  createAffiliation(input: {
    personId: number;
    facilityId: number;
    roleTitle?: string | null;
    notes?: string | null;
  }): Promise<{ id: number }>;

  /** Idempotent — ON CONFLICT DO NOTHING on PK. */
  addClassification(input: {
    personFacilityId: number;
    classificationCode: ClassificationCode;
  }): Promise<void>;

  updatePerson(personId: number, input: UpdatePersonInput): Promise<void>;

  updateAffiliation(personFacilityId: number, input: UpdateAffiliationInput): Promise<void>;

  /** Atomic replace-set: delete all assignments for the affiliation, then insert `roleCodes`. */
  replaceRoleAssignments(input: {
    personFacilityId: number;
    roleCodes: string[];
  }): Promise<void>;
}
