export interface RegistryFacilityProjection {
  facilityId: string;
  cnesCode: string | null;
  legalName: string | null;
  tradeName: string | null;
  displayName: string | null;
  streetAddress: string | null;
  streetNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  email: string | null;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  taxIdCnpj: string | null;
  taxIdCpf: string | null;
  facilityTypeCode: string | null;
  deactivationReasonCode: string | null;
  lastUpdatedDate: string | null;
}

export interface RegistryProfessionalProjection {
  professionalId: string;
  fullName: string;
  socialName: string | null;
  occupationCode: string;
  municipalityId: string | null;
  employmentTypeCode: string | null;
  startDate: string | null;
  terminationDate: string | null;
  lastUpdatedDate: string | null;
}

export interface RegistryRepresentativeProjection {
  facilityId: string;
  externalKey: string;
  representativeName: string;
  roleTitle: string | null;
  email: string | null;
  taxId: string | null;
  lastUpdatedDate: string | null;
}

export interface RegistryReadRepository {
  findFacilityByRegistryId(registryFacilityId: string): Promise<RegistryFacilityProjection | null>;

  findProfessionalsByFacility(registryFacilityId: string): Promise<RegistryProfessionalProjection[]>;

  findRepresentativesByFacility(
    registryFacilityId: string
  ): Promise<RegistryRepresentativeProjection[]>;
}
