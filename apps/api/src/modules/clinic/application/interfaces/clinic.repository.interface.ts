export interface ClinicRecord {
  id: string;
  name: string;
  address: string | null;
  territoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ClinicListScopeFilter {
  isGlobal: boolean;
  clinicIds?: string[];
}

export interface ClinicRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    scope: ClinicListScopeFilter;
  }): Promise<{ clinics: ClinicRecord[]; total: number }>;

  findById(id: string): Promise<ClinicRecord | null>;

  create(data: {
    name: string;
    address?: string | null;
    territoryId?: string | null;
  }): Promise<ClinicRecord>;

  update(
    id: string,
    data: {
      name?: string;
      address?: string | null;
      territoryId?: string | null;
    }
  ): Promise<ClinicRecord>;

  softDelete(id: string): Promise<void>;

  findIdsByTerritoryIds(territoryIds: string[]): Promise<string[]>;
}
