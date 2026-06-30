export interface FacilityRepresentativeRecord {
  id: string;
  facilityId: string;
  representativeName: string;
  roleTitle: string | null;
  email: string | null;
  taxId: string | null;
  externalSourceKey: string | null;
  sourceActive: boolean;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityRepresentativeRepository {
  findByFacilityAndExternalKey(
    facilityId: string,
    externalKey: string
  ): Promise<FacilityRepresentativeRecord | null>;

  upsertFromRegistry(params: {
    facilityId: string;
    externalSourceKey: string;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    taxId?: string | null;
  }): Promise<FacilityRepresentativeRecord>;

  confirm(params: {
    facilityId: string;
    externalSourceKey: string;
    confirmedByUserId: string;
  }): Promise<FacilityRepresentativeRecord>;
}
