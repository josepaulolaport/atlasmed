export interface HealthcareProfessionalFacilitySummary {
  id: number;
  name: string;
}

export interface HealthcareProfessionalRecord {
  id: number;
  firstName: string;
  lastName: string;
  socialName: string | null;
  cpf: string | null;
  specialty: string | null;
  facilityIds: number[];
  displayFacility?: HealthcareProfessionalFacilitySummary | null;
  /** Prefer primary active reg; else first active. Null when none. */
  primaryRegistrationDisplay?: string | null;
  createdAt: Date;
  updatedAt: Date;
  distanceKm?: number | null;
}

export interface HealthcareProfessionalListScopeFilter {
  isGlobal: boolean;
  facilityIds?: number[];
}

export interface HealthcareProfessionalRepository {
  findAll(params: {
    page: number;
    limit: number;
    search?: string;
    facilityId?: number;
    /**
     * Exclude people currently working at this facility.
     *
     * Applied inside the query, before `LIMIT`, so a page of results is a page of
     * genuine candidates. Filtering the returned page instead silently shortens
     * it and strands everyone past the cutoff.
     */
    excludeFacilityId?: number;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: HealthcareProfessionalListScopeFilter;
    sort?: string;
    order?: "asc" | "desc";
    /** Internal canonical hydration constraint for a Meilisearch result page. */
    candidateIds?: number[];
  }): Promise<{ professionals: HealthcareProfessionalRecord[]; total: number }>;

  findAllByIds(params: {
    ids: number[];
    facilityId?: number;
    excludeFacilityId?: number;
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: HealthcareProfessionalListScopeFilter;
  }): Promise<HealthcareProfessionalRecord[]>;
}
