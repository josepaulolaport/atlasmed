export interface FacilityHealthcareProviderShareRecord {
  id: string;
  facilityId: string;
  healthcareProviderId: string;
  sharePercent: number;
  isPackage: boolean;
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
    isPackage?: boolean;
  }): Promise<FacilityHealthcareProviderShareRecord>;

  /** Atomically replace all shares for a facility (empty clears the mix). */
  replaceByFacility(
    facilityId: string,
    shares: Array<{
      healthcareProviderId: string;
      sharePercent: number;
      isPackage?: boolean;
    }>
  ): Promise<FacilityHealthcareProviderShareRecord[]>;

  sumSharePercentForFacility(facilityId: string): Promise<number>;
}
