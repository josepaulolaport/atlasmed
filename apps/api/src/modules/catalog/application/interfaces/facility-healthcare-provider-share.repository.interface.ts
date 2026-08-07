export interface FacilityHealthcareProviderShareRecord {
  id: number;
  facilityId: number;
  healthcareProviderId: number;
  sharePercent: number;
  isPackage: boolean;
  createdAt: Date;
  updatedAt: Date;
  healthcareProvider: {
    id: number;
    name: string;
    type: string;
  };
}

export interface FacilityHealthcareProviderShareRepository {
  findByFacility(facilityId: number): Promise<FacilityHealthcareProviderShareRecord[]>;

  create(data: {
    facilityId: number;
    healthcareProviderId: number;
    sharePercent: number;
    isPackage?: boolean;
  }): Promise<FacilityHealthcareProviderShareRecord>;

  /** Atomically replace all shares for a facility (empty clears the mix). */
  replaceByFacility(
    facilityId: number,
    shares: Array<{
      healthcareProviderId: number;
      sharePercent: number;
      isPackage?: boolean;
    }>
  ): Promise<FacilityHealthcareProviderShareRecord[]>;

  sumSharePercentForFacility(facilityId: number): Promise<number>;
}
