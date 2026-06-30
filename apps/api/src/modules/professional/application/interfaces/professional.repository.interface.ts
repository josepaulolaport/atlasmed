export interface ProfessionalRecord {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
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
}

export interface DoctorListScopeFilter {
  isGlobal: boolean;
  facilityIds?: string[];
}

export interface DoctorSourceUpsertInput {
  sourceProvider: string;
  externalSourceId: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  sourceContentHash: string;
  sourceLastSeenAt: Date;
}

export interface ProfessionalRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    facilityId?: string;
    scope: DoctorListScopeFilter;
  }): Promise<{ professionals: ProfessionalRecord[]; total: number }>;

  findById(id: string): Promise<ProfessionalRecord | null>;

  findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<ProfessionalRecord | null>;

  findSourceTrackedByProvider(sourceProvider: string): Promise<ProfessionalRecord[]>;

  create(data: {
    firstName: string;
    lastName: string;
    specialty?: string | null;
    facilityIds: string[];
    confirmedByUserId?: string;
  }): Promise<ProfessionalRecord>;

  update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      specialty?: string | null;
      manuallyEditedAt?: Date;
    }
  ): Promise<ProfessionalRecord>;

  softDelete(id: string): Promise<void>;

  markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void>;

  upsertFromSource(input: DoctorSourceUpsertInput): Promise<{
    doctor: ProfessionalRecord;
    created: boolean;
    updated: boolean;
  }>;

  findExistingClinicIds(facilityIds: string[]): Promise<string[]>;
}
