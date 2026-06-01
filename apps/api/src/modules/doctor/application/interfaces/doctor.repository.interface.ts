export interface DoctorRecord {
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
  clinicIds: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface DoctorListScopeFilter {
  isGlobal: boolean;
  clinicIds?: string[];
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

export interface DoctorRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    clinicId?: string;
    scope: DoctorListScopeFilter;
  }): Promise<{ doctors: DoctorRecord[]; total: number }>;

  findById(id: string): Promise<DoctorRecord | null>;

  findByExternalId(
    sourceProvider: string,
    externalSourceId: string
  ): Promise<DoctorRecord | null>;

  findSourceTrackedByProvider(sourceProvider: string): Promise<DoctorRecord[]>;

  create(data: {
    firstName: string;
    lastName: string;
    specialty?: string | null;
    clinicIds: string[];
    confirmedByUserId?: string;
  }): Promise<DoctorRecord>;

  update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      specialty?: string | null;
      manuallyEditedAt?: Date;
    }
  ): Promise<DoctorRecord>;

  softDelete(id: string): Promise<void>;

  markSourceAbsent(id: string, sourceLastSeenAt: Date): Promise<void>;

  upsertFromSource(input: DoctorSourceUpsertInput): Promise<{
    doctor: DoctorRecord;
    created: boolean;
    updated: boolean;
  }>;

  findExistingClinicIds(clinicIds: string[]): Promise<string[]>;
}
