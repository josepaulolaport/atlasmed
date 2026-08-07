import type { RelationshipLevel } from "@atlasmed/database";

export interface ProfessionalFacilitySummary {
  id: number;
  name: string;
}

export interface ProfessionalNoteRecord {
  id: number;
  userId: number;
  professionalId: number;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalRecord {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string | null;
  socialName: string | null;
  taxId: string | null;
  birthDate: Date | null;
  mobilePhone: string | null;
  landlinePhone: string | null;
  email: string | null;
  websiteUrl: string | null;
  imageUrl: string | null;
  imageBlurhash: string | null;
  favoriteTeam: string | null;
  favoriteSport: string | null;
  languages: string | null;
  hobbies: string | null;
  specialty: string | null;
  crmCouncil: string | null;
  crmNumber: string | null;
  crmState: string | null;
  facilityIds: number[];
  /**
   * Deterministic display facility for list surfaces: the first active,
   * visible association ordered by facility name.
   */
  displayFacility?: ProfessionalFacilitySummary | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  /** Present only when a coordinate query was supplied. */
  distanceKm?: number | null;
}

export interface ProfessionalListScopeFilter {
  isGlobal: boolean;
  facilityIds?: number[];
}

export interface ProfessionalCreateInput {
  firstName: string;
  lastName: string;
  fullName?: string | null;
  socialName?: string | null;
  taxId?: string | null;
  birthDate?: Date | null;
  mobilePhone?: string | null;
  landlinePhone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  imageUrl?: string | null;
  imageBlurhash?: string | null;
  favoriteTeam?: string | null;
  favoriteSport?: string | null;
  languages?: string | null;
  hobbies?: string | null;
  specialty?: string | null;
  crmCouncil?: string | null;
  crmNumber?: string | null;
  crmState?: string | null;
  facilityIds: number[];
  confirmedByUserId?: number;
}

export interface ProfessionalUpdateInput {
  firstName?: string;
  lastName?: string;
  fullName?: string | null;
  socialName?: string | null;
  taxId?: string | null;
  birthDate?: Date | null;
  mobilePhone?: string | null;
  landlinePhone?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  imageUrl?: string | null;
  imageBlurhash?: string | null;
  favoriteTeam?: string | null;
  favoriteSport?: string | null;
  languages?: string | null;
  hobbies?: string | null;
  specialty?: string | null;
  crmCouncil?: string | null;
  crmNumber?: string | null;
  crmState?: string | null;
}

/** @deprecated Use ProfessionalListScopeFilter */
export type DoctorListScopeFilter = ProfessionalListScopeFilter;

export interface ProfessionalRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    facilityId?: number;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: ProfessionalListScopeFilter;
    sort?: string;
    order?: "asc" | "desc";
    /** Internal canonical hydration constraint for a Meilisearch result page. */
    candidateIds?: number[];
  }): Promise<{ professionals: ProfessionalRecord[]; total: number }>;

  /** Distinct non-empty specialty labels visible under the caller's facility scope. */
  listDistinctSpecialties(scope: ProfessionalListScopeFilter): Promise<string[]>;

  /** Hydrates ranked search candidates while enforcing canonical list eligibility. */
  findAllByIds(params: {
    ids: number[];
    facilityId?: number;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: ProfessionalListScopeFilter;
  }): Promise<ProfessionalRecord[]>;

  findById(id: number): Promise<ProfessionalRecord | null>;

  findIdByCnesProfessionalId(cnesProfessionalId: string): Promise<number | null>;

  findActiveFacilities(professionalId: number): Promise<ProfessionalFacilitySummary[]>;

  findNotesByProfessionalAndUser(
    professionalId: number,
    userId: number
  ): Promise<ProfessionalNoteRecord[]>;

  createNote(input: {
    professionalId: number;
    userId: number;
    note: string;
  }): Promise<ProfessionalNoteRecord>;

  create(data: ProfessionalCreateInput): Promise<ProfessionalRecord>;

  update(id: number, data: ProfessionalUpdateInput): Promise<ProfessionalRecord>;

  softDelete(id: number): Promise<void>;

  findExistingFacilityIds(facilityIds: number[]): Promise<number[]>;
}
