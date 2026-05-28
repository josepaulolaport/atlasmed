export interface DoctorRecord {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  clinicIds: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface DoctorListScopeFilter {
  isGlobal: boolean;
  clinicIds?: string[];
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

  create(data: {
    firstName: string;
    lastName: string;
    specialty?: string | null;
    clinicIds: string[];
  }): Promise<DoctorRecord>;

  update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      specialty?: string | null;
      clinicIds?: string[];
    }
  ): Promise<DoctorRecord>;

  softDelete(id: string): Promise<void>;

  findExistingClinicIds(clinicIds: string[]): Promise<string[]>;
}
