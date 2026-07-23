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
  id: string;
  facilityId: string;
  representativeName: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  contactType: FacilityRepresentativeContactType;
  sourceProvider: string | null;
  externalSourceKey: string | null;
  sourceActive: boolean;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
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
  findByFacilityAndExternalKey(
    facilityId: string,
    externalKey: string
  ): Promise<FacilityRepresentativeRecord | null>;

  findByIdForFacility(
    facilityId: string,
    representativeId: string
  ): Promise<FacilityRepresentativeRecord | null>;

  /** Active CRM representatives (`ended_at IS NULL`), name ascending. */
  findActiveByFacility(params: {
    facilityId: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<FacilityRepresentativeListPage>;

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

  /** Manual CRM create (no registry external key). */
  createManual(params: {
    facilityId: string;
    representativeName: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: FacilityRepresentativeContactType;
    roles?: FacilityRepresentativeRolePatch;
    confirmedByUserId: string;
  }): Promise<FacilityRepresentativeRecord>;

  updateManual(params: {
    facilityId: string;
    representativeId: string;
    representativeName?: string;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    contactType?: FacilityRepresentativeContactType;
    roles?: FacilityRepresentativeRolePatch;
  }): Promise<FacilityRepresentativeRecord | null>;

  endSourceRepresentative(params: {
    facilityId: string;
    externalSourceKey: string;
    endedByUserId: string;
    endReason?: string;
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
