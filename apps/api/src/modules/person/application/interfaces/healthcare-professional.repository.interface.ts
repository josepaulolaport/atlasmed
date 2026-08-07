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
  crmCouncil: string | null;
  crmNumber: string | null;
  crmState: string | null;
  facilityIds: number[];
  displayFacility?: HealthcareProfessionalFacilitySummary | null;
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
    specialty?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    scope: HealthcareProfessionalListScopeFilter;
  }): Promise<HealthcareProfessionalRecord[]>;
}
