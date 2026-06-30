export interface FacilityProfessionalRecord {
  id: string;
  professionalId: string;
  facilityId: string;
  occupationCode: string;
  sourceActive: boolean;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
  endedByUserId: string | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityProfessionalWithProfessionalRecord
  extends FacilityProfessionalRecord {
  professional: {
    id: string;
    firstName: string;
    lastName: string;
    specialty: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export type FacilityProfessionalView = "source" | "confirmed" | "pending" | "all";

export interface FacilityProfessionalRepository {
  findByProfessionalAndFacility(
    professionalId: string,
    facilityId: string,
    occupationCode?: string
  ): Promise<FacilityProfessionalRecord | null>;

  findActiveByFacilityWithProfessionals(params: {
    facilityId: string;
    view: FacilityProfessionalView;
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    associations: FacilityProfessionalWithProfessionalRecord[];
    total: number;
  }>;

  findActiveSourceAssociationsByProvider(sourceProvider: string): Promise<
    Array<{
      association: FacilityProfessionalRecord;
      professionalExternalSourceId: string;
      facilityExternalSourceId: string;
    }>
  >;

  confirmAssociation(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    confirmedByUserId: string;
  }): Promise<FacilityProfessionalRecord>;

  manuallyAssociate(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    confirmedByUserId: string;
  }): Promise<FacilityProfessionalRecord>;

  endAssociation(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<FacilityProfessionalRecord | null>;

  upsertSourceAssociation(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    sourceLastSeenAt: Date;
  }): Promise<{ association: FacilityProfessionalRecord; created: boolean }>;

  markSourceInactive(params: {
    facilityProfessionalId: string;
    sourceLastSeenAt: Date;
  }): Promise<FacilityProfessionalRecord>;

  restoreSourceActive(facilityProfessionalId: string): Promise<FacilityProfessionalRecord>;

  endAssociationById(params: {
    facilityProfessionalId: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<FacilityProfessionalRecord>;

  createConfirmedAssociations(params: {
    professionalId: string;
    facilityIds: string[];
    occupationCode?: string;
    confirmedByUserId?: string;
  }): Promise<void>;
}
