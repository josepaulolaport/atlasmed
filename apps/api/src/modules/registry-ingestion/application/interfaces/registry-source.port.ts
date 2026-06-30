export interface SanitizedFacilityRecord {
  externalSourceId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  contentHash: string;
}

export interface SanitizedProfessionalRecord {
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
  facilities: SanitizedFacilityRecord[];
  doctors: SanitizedProfessionalRecord[];
  associations: SanitizedAssociationRecord[];
}

export interface RegistrySourcePort {
  fetchSnapshot(): Promise<RegistrySnapshot>;
}

export const MOCK_REGISTRY_PROVIDER = "mock_registry";
