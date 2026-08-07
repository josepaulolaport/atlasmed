export type FacilityRepresentativeContactType =
  | "PROFESSIONAL"
  | "DECISOR"
  | "COMPRADOR";

export interface FacilityRepresentativeRoleFlags {
  isPartner: boolean;
  isAdministrator: boolean;
  isDecisionMaker: boolean;
  isBuyer: boolean;
  isBiller: boolean;
  isSecretary: boolean;
}

export interface FacilityRepresentativeRecord extends FacilityRepresentativeRoleFlags {
  id: number;
  facilityId: number;
  representativeName: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  contactType: FacilityRepresentativeContactType;
  confirmedAt: Date | null;
  confirmedByUserId: number | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FacilityRepresentativeListPage {
  items: FacilityRepresentativeRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type FacilityRepresentativeRolePatch = Partial<FacilityRepresentativeRoleFlags>;

export interface FacilityRepresentativeRepository {
  findByIdForFacility(
    facilityId: number,
    representativeId: number
  ): Promise<FacilityRepresentativeRecord | null>;

  /** Active CRM representatives (`ended_at IS NULL`), name ascending. */
  findActiveByFacility(params: {
    facilityId: number;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<FacilityRepresentativeListPage>;

  /** Manual CRM create. */
  createManual(params: {
    facilityId: number;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: FacilityRepresentativeContactType;
    roles?: FacilityRepresentativeRolePatch;
    confirmedByUserId: number;
  }): Promise<FacilityRepresentativeRecord>;

  updateManual(params: {
    facilityId: number;
    representativeId: number;
    representativeName?: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: FacilityRepresentativeContactType;
    roles?: FacilityRepresentativeRolePatch;
  }): Promise<FacilityRepresentativeRecord | null>;
}

/** Derive legacy contactType from role flags for back-compat. */
export function contactTypeFromRoles(
  roles: FacilityRepresentativeRoleFlags
): FacilityRepresentativeContactType {
  if (roles.isDecisionMaker) return "DECISOR";
  if (roles.isBuyer) return "COMPRADOR";
  return "PROFESSIONAL";
}
