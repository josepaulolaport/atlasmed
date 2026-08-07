export interface FacilityProfessionalRecord {
  id: number;
  professionalId: number;
  facilityId: number;
  occupationCode: string;
  specialtyLabel: string | null;
  isPartner: boolean;
  isPrescriber: boolean;
  isBuyer: boolean;
  isDecisionMaker: boolean;
  notes: string | null;
  confirmedAt: Date | null;
  confirmedByUserId: number | null;
  endedAt: Date | null;
  endedByUserId: number | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityProfessionalWithProfessionalRecord
  extends FacilityProfessionalRecord {
  professional: {
    id: number;
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
    id: number;
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
    imageBlurhash: string | null;
    primarySpecialtyLabel: string | null;
    crmCouncil: string | null;
    crmNumber: string | null;
    crmState: string | null;
    favoriteTeam: string | null;
    favoriteSport: string | null;
    languages: string | null;
    hobbies: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export type FacilityProfessionalView = "confirmed" | "all";

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
    professionalId: number,
    facilityId: number,
    occupationCode?: string
  ): Promise<FacilityProfessionalRecord | null>;

  findActiveWithProfessional(
    facilityId: number,
    professionalId: number,
    occupationCode?: string
  ): Promise<FacilityProfessionalContextRecord | null>;

  findActiveByFacilityWithProfessionals(params: {
    facilityId: number;
    view: FacilityProfessionalView;
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    associations: FacilityProfessionalWithProfessionalRecord[];
    total: number;
  }>;

  confirmAssociation(params: {
    professionalId: number;
    facilityId: number;
    occupationCode?: string;
    confirmedByUserId: number;
  }): Promise<FacilityProfessionalRecord>;

  manuallyAssociate(params: {
    professionalId: number;
    facilityId: number;
    occupationCode?: string;
    confirmedByUserId: number;
  }): Promise<FacilityProfessionalRecord>;

  endAssociation(params: {
    professionalId: number;
    facilityId: number;
    occupationCode?: string;
    endedByUserId: number;
    endReason: string;
  }): Promise<FacilityProfessionalRecord | null>;

  updateAssociationRoles(params: {
    professionalId: number;
    facilityId: number;
    occupationCode?: string;
    data: FacilityProfessionalRoleUpdateInput;
  }): Promise<FacilityProfessionalRecord | null>;

  endAssociationById(params: {
    facilityProfessionalId: number;
    endedByUserId: number;
    endReason: string;
  }): Promise<FacilityProfessionalRecord>;

  createConfirmedAssociations(params: {
    professionalId: number;
    facilityIds: number[];
    occupationCode?: string;
    confirmedByUserId?: number;
  }): Promise<void>;
}
