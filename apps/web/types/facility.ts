import type {
  CreateProfessionalInput,
  FacilityProfessionalRole,
  ProfessionalFacilityContext,
  ProfessionalFacilitySummary,
  ProfessionalProfile,
  UpdateFacilityProfessionalInput,
  UpdateProfessionalInput,
} from "@atlasmed/access";

export type TerritoryAssignmentStatus = "assigned" | "unassigned" | "ambiguous";

export type PurchaseStatus = "NAO_COMPRA" | "COMPRA" | "COMPRA_POUCO" | "COMPRA_MUITO";

export interface Facility {
  id: string;
  name: string;
  address?: string;
  city?: string;
  stateCode?: string;
  lat?: number;
  lng?: number;
  cnpj?: string;
  territoryId?: string;
  territoryAssignmentStatus?: TerritoryAssignmentStatus;
  purchaseStatus?: PurchaseStatus;
  professionalCount?: number;
  consultantName?: string | null;
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
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  specialty?: string;
  primarySpecialtyLabel?: string;
  crmNumber?: string;
  crmState?: string;
  facilityIds: string[];
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
  cnpj?: string;
  lat?: number;
  lng?: number;
}

export interface UpdateClinicRequest {
  name?: string;
  address?: string | null;
  city?: string | null;
  stateCode?: string | null;
  cnpj?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export type FacilityProfessionalView = "source" | "confirmed" | "pending" | "all";

export interface FacilityProfessionalAssociationView extends FacilityProfessionalRole {
  sourceActive: boolean;
  sourceFirstSeenAt?: string;
  sourceLastSeenAt?: string;
  confirmedAt?: string;
  confirmedByUserId?: string;
  pendingConfirmation: boolean;
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

export interface RegistrySuggestion {
  id: string;
  ingestionRunId: string;
  type: "FACILITY_REGISTRY_DEACTIVATED" | "FACILITY_REGISTRY_REACTIVATED" | "DOCTOR_FACILITY_REGISTRY_DEACTIVATED";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "SUPERSEDED";
  facilityId?: string;
  professionalId?: string;
  facilityProfessionalId?: string;
  reason?: string;
  payload: Record<string, unknown>;
  suggestedAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolutionNote?: string;
}

export interface RegistryDemoResult {
  steps: Array<{
    fixture: string;
    label: string;
    skipped: boolean;
    reason?: string;
    runId?: string;
    suggestionsCreated?: number;
  }>;
  pendingSuggestions: RegistrySuggestion[];
  summary: {
    pendingCount: number;
    clinicRemovals: number;
    clinicReactivations: number;
    doctorClinicRemovals: number;
  };
}
