export interface SanitizedClinicRecord {
  externalSourceId: string;
  name: string;
  address: string | null;
  territoryId: string | null;
  contentHash: string;
}

export interface SanitizedDoctorRecord {
  externalSourceId: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  contentHash: string;
}

export interface SanitizedAssociationRecord {
  doctorExternalId: string;
  clinicExternalId: string;
}

export interface RegistrySnapshot {
  provider: string;
  fetchedAt: Date;
  clinics: SanitizedClinicRecord[];
  doctors: SanitizedDoctorRecord[];
  associations: SanitizedAssociationRecord[];
}

export interface RegistrySourcePort {
  fetchSnapshot(): Promise<RegistrySnapshot>;
}

export const MOCK_REGISTRY_PROVIDER = "mock_registry";
