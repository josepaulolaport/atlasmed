export type TerritoryAssignmentStatus = "assigned" | "unassigned" | "ambiguous";

export interface Clinic {
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

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  clinicIds: string[];
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
  clinicIds?: string[];
}

export interface UpdateDoctorRequest {
  firstName?: string;
  lastName?: string;
  specialty?: string | null;
  clinicIds?: string[];
}

export type DoctorClinicView = "source" | "confirmed" | "pending" | "all";

export interface ClinicDoctorAssociationView {
  sourceActive: boolean;
  sourceFirstSeenAt?: string;
  sourceLastSeenAt?: string;
  confirmedAt?: string;
  confirmedByUserId?: string;
  pendingConfirmation: boolean;
}

export interface ClinicDoctorListItem {
  associationId: string;
  doctor: Doctor;
  association: ClinicDoctorAssociationView;
}

export interface RegistrySuggestion {
  id: string;
  ingestionRunId: string;
  type: "CLINIC_REMOVAL" | "CLINIC_REACTIVATION" | "DOCTOR_CLINIC_REMOVAL";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "SUPERSEDED";
  clinicId?: string;
  doctorId?: string;
  associationId?: string;
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
