import type {
  CreateProfessionalInput,
  FacilityProfessionalRole,
  ProfessionalFacilityContext,
  ProfessionalFacilitySummary,
  ProfessionalProfile,
  UpdateFacilityProfessionalInput,
  UpdateProfessionalInput,
} from "@atlasmed/access";

export type TerritoryAssignmentStatus = "assigned" | "unassigned";

export type FacilityPurchaseStatus =
  | "NON_BUYER"
  | "LOW_BUYER"
  | "REGULAR_BUYER"
  | "HIGH_BUYER";

export type FacilityLegalDocumentType = "CNPJ" | "CPF";

export interface FacilityClinicalFocusItem {
  id: number;
  name: string;
  cnesCode?: string | null;
}

export interface FacilityVerticalProfileItem {
  verticalId: number;
  verticalCode?: string;
  verticalName?: string;
  isActive?: boolean;
  commercialStatus?: string;
  purchaseStatus?: FacilityPurchaseStatus;
  territoryId?: number | null;
}

export interface Facility {
  id: string;
  name: string;
  address?: string;
  city?: string;
  stateCode?: string;
  lat?: number;
  lng?: number;
  legalDocumentType?: FacilityLegalDocumentType | null;
  legalDocument?: string | null;
  territoryId?: string;
  territoryAssignmentStatus?: TerritoryAssignmentStatus;
  /** Per-Linha commercial state — never a facility top-level SoT. */
  verticalProfiles?: FacilityVerticalProfileItem[];
  professionalCount?: number;
  consultantName?: string | null;
  clinicalFocuses?: FacilityClinicalFocusItem[];
  createdAt: string;
  updatedAt: string;
}

export type {
  ProfessionalProfile,
  ProfessionalFacilityContext,
  FacilityProfessionalRole,
  ProfessionalFacilitySummary,
  CreateProfessionalInput,
  UpdateProfessionalInput,
  UpdateFacilityProfessionalInput,
};

/** List item shape returned by GET /professionals */
export interface Professional {
  id: number;
  firstName: string;
  lastName: string;
  fullName?: string;
  specialty?: string;
  primarySpecialtyLabel?: string;
  crmNumber?: string;
  crmState?: string;
  facilityIds: number[];
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Use CreateProfessionalInput */
export type CreateDoctorRequest = CreateProfessionalInput;

/** @deprecated Use UpdateProfessionalInput */
export type UpdateDoctorRequest = UpdateProfessionalInput;

export interface CreateClinicRequest {
  name: string;
  address?: string;
  city?: string;
  stateCode?: string;
  legalDocumentType?: FacilityLegalDocumentType;
  legalDocument?: string;
  lat?: number;
  lng?: number;
}

export interface UpdateClinicRequest {
  name?: string;
  address?: string | null;
  city?: string | null;
  stateCode?: string | null;
  legalDocumentType?: FacilityLegalDocumentType | null;
  legalDocument?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export type FacilityProfessionalView = "confirmed" | "all";

export interface FacilityProfessionalAssociationView extends FacilityProfessionalRole {
  confirmedAt?: string;
  confirmedByUserId?: string;
}

export interface FacilityProfessionalListItem {
  facilityProfessionalId: string;
  professional: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    specialty?: string;
    crmNumber?: string;
    crmState?: string;
    createdAt: string;
    updatedAt: string;
  };
  association: FacilityProfessionalAssociationView;
}
