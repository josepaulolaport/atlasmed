export interface FacilityHealthcareProviderShareRecord {
  id: string;
  facilityId: string;
  healthcareProviderId: string;
  sharePercent: number;
  source: "MANUAL" | "REGISTRY" | "IMPORT";
  createdAt: Date;
  updatedAt: Date;
  healthcareProvider: {
    id: string;
    name: string;
    type: string;
  };
}

export interface FacilityHealthcareProviderShareRepository {
  findByFacility(facilityId: string): Promise<FacilityHealthcareProviderShareRecord[]>;

  create(data: {
    facilityId: string;
    healthcareProviderId: string;
    sharePercent: number;
  }): Promise<FacilityHealthcareProviderShareRecord>;

  sumSharePercentForFacility(facilityId: string): Promise<number>;
}
