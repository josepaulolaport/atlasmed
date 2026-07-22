export interface FacilityProfessionalRecord {
  id: string;
  professionalId: string;
  facilityId: string;
  occupationCode: string;
  specialtyLabel: string | null;
  isPartner: boolean;
  isPrescriber: boolean;
  isBuyer: boolean;
  isDecisionMaker: boolean;
  notes: string | null;
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
    fullName: string | null;
    specialty: string | null;
    crmNumber: string | null;
    crmState: string | null;
    mobilePhone: string | null;
    landlinePhone: string | null;
    email: string | null;
    birthDate: Date | null;
    favoriteTeam: string | null;
    hobbies: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface FacilityProfessionalContextRecord {
  association: FacilityProfessionalRecord;
  professional: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string | null;
    socialName: string | null;
    taxId: string | null;
    birthDate: Date | null;
    mobilePhone: string | null;
    landlinePhone: string | null;
    email: string | null;
    websiteUrl: string | null;
    imageUrl: string | null;
    primarySpecialtyLabel: string | null;
    crmCouncil: string | null;
    crmNumber: string | null;
    crmState: string | null;
    favoriteTeam: string | null;
    favoriteSport: string | null;
    hobbies: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export type FacilityProfessionalView = "source" | "confirmed" | "pending" | "all";

export interface FacilityProfessionalRoleUpdateInput {
  isPartner?: boolean;
  isPrescriber?: boolean;
  isBuyer?: boolean;
  isDecisionMaker?: boolean;
  specialtyLabel?: string | null;
  notes?: string | null;
}

export interface FacilityProfessionalRepository {
  findByProfessionalAndFacility(
    professionalId: string,
    facilityId: string,
    occupationCode?: string
  ): Promise<FacilityProfessionalRecord | null>;

  findActiveWithProfessional(
    facilityId: string,
    professionalId: string,
    occupationCode?: string
  ): Promise<FacilityProfessionalContextRecord | null>;

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

  updateAssociationRoles(params: {
    professionalId: string;
    facilityId: string;
    occupationCode?: string;
    data: FacilityProfessionalRoleUpdateInput;
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
