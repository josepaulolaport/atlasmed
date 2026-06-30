export type TerritoryAssignmentStatus = "assigned" | "unassigned" | "ambiguous";

export interface Facility {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  territoryId?: string;
  territoryAssignmentStatus?: TerritoryAssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Professional {
  id: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  facilityIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateClinicRequest {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface UpdateClinicRequest {
  name?: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface CreateDoctorRequest {
  firstName: string;
  lastName: string;
  specialty?: string;
  facilityIds?: string[];
}

export interface UpdateDoctorRequest {
  firstName?: string;
  lastName?: string;
  specialty?: string | null;
  facilityIds?: string[];
}

export type FacilityProfessionalView = "source" | "confirmed" | "pending" | "all";

export interface FacilityProfessionalAssociationView {
  sourceActive: boolean;
  sourceFirstSeenAt?: string;
  sourceLastSeenAt?: string;
  confirmedAt?: string;
  confirmedByUserId?: string;
  pendingConfirmation: boolean;
}

export interface FacilityProfessionalListItem {
  facilityProfessionalId: string;
  doctor: Doctor;
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
