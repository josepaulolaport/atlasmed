import type { RelationshipLevel } from "@atlasmed/database";

export interface ProfessionalFacilitySummary {
  id: string;
  name: string;
}

export interface ProfessionalNoteRecord {
  id: string;
  userId: string;
  professionalId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalRecord {
  id: string;
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
  favoriteTeam: string | null;
  favoriteSport: string | null;
  languages: string | null;
  hobbies: string | null;
  notes: string | null;
  specialty: string | null;
  crmCouncil: string | null;
  crmNumber: string | null;
  crmState: string | null;
  sourceProvider: string | null;
  externalSourceId: string | null;
  sourceContentHash: string | null;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  sourcePresent: boolean;
  sourceTracked: boolean;
  manuallyEditedAt: Date | null;
  facilityIds: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  /** Present only when a coordinate query was supplied. */
  distanceKm?: number | null;
}

export interface ProfessionalListScopeFilter {
  isGlobal: boolean;
  facilityIds?: string[];
}

export interface ProfessionalSourceUpsertInput {
  sourceProvider: string;
  externalSourceId: string;
  firstName: string;
  lastName: string;
  fullName?: string | null;
  socialName?: string | null;
  taxId?: string | null;
  specialty: string | null;
  crmCouncil?: string | null;
  crmNumber?: string | null;
  crmState?: string | null;
  sourceContentHash: string;
  sourceLastSeenAt: Date;
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
  favoriteTeam?: string | null;
  favoriteSport?: string | null;
  languages?: string | null;
  hobbies?: string | null;
  notes?: string | null;
  specialty?: string | null;
  crmCouncil?: string | null;
  crmNumber?: string | null;
  crmState?: string | null;
  facilityIds: string[];
  confirmedByUserId?: string;
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
  favoriteTeam?: string | null;
  favoriteSport?: string | null;
  languages?: string | null;
  hobbies?: string | null;
  notes?: string | null;
  specialty?: string | null;
  crmCouncil?: string | null;
  crmNumber?: string | null;
  crmState?: string | null;
  manuallyEditedAt?: Date;
}

/** @deprecated Use ProfessionalListScopeFilter */
export type DoctorListScopeFilter = ProfessionalListScopeFilter;
/** @deprecated Use ProfessionalSourceUpsertInput */
export type DoctorSourceUpsertInput = ProfessionalSourceUpsertInput;

export interface ProfessionalRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    facilityId?: string;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: ProfessionalListScopeFilter;
    /** Internal canonical hydration constraint for a Meilisearch result page. */
    candidateIds?: string[];
  }): Promise<{ professionals: ProfessionalRecord[]; total: number }>;

  /** Distinct non-empty specialty labels visible under the caller's facility scope. */
  listDistinctSpecialties(scope: ProfessionalListScopeFilter): Promise<string[]>;

  /** Hydrates ranked search candidates while enforcing canonical list eligibility. */
  findAllByIds(params: {
    ids: string[];
    facilityId?: string;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: ProfessionalListScopeFilter;
  }): Promise<ProfessionalRecord[]>;

  findById(id: string): Promise<ProfessionalRecord | null>;

  findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<ProfessionalRecord | null>;

  findSourceTrackedByProvider(sourceProvider: string): Promise<ProfessionalRecord[]>;

  findActiveFacilities(professionalId: string): Promise<ProfessionalFacilitySummary[]>;

  findNotesByProfessionalAndUser(
    professionalId: string,
    userId: string
  ): Promise<ProfessionalNoteRecord[]>;

  createNote(input: {
    professionalId: string;
    userId: string;
    note: string;
  }): Promise<ProfessionalNoteRecord>;

  create(data: ProfessionalCreateInput): Promise<ProfessionalRecord>;

  update(id: string, data: ProfessionalUpdateInput): Promise<ProfessionalRecord>;

  softDelete(id: string): Promise<void>;

  markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void>;

  upsertFromSource(input: ProfessionalSourceUpsertInput): Promise<{
    professional: ProfessionalRecord;
    created: boolean;
    updated: boolean;
  }>;

  findExistingFacilityIds(facilityIds: string[]): Promise<string[]>;
}
