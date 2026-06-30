import type {
  RegistryFacilityProjection,
  RegistryProfessionalProjection,
  RegistryRepresentativeProjection,
} from "../interfaces/registry-read.repository.interface";

export function projectRegistryFacility(row: {
  facilityId: string;
  cnesCode: string | null;
  legalName: string | null;
  tradeName: string | null;
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
}): RegistryFacilityProjection {
  const displayName = row.tradeName?.trim() || row.legalName?.trim() || null;

  return {
    facilityId: row.facilityId,
    cnesCode: row.cnesCode,
    legalName: row.legalName,
    tradeName: row.tradeName,
    displayName,
    streetAddress: row.streetAddress,
    streetNumber: row.streetNumber,
    addressComplement: row.addressComplement,
    neighborhood: row.neighborhood,
    postalCode: row.postalCode,
    phoneNumber: row.phoneNumber,
    faxNumber: row.faxNumber,
    email: row.email,
    websiteUrl: row.websiteUrl,
    latitude: row.latitude,
    longitude: row.longitude,
    taxIdCnpj: row.taxIdCnpj,
    taxIdCpf: row.taxIdCpf,
    facilityTypeCode: row.facilityTypeCode,
    deactivationReasonCode: row.deactivationReasonCode,
    lastUpdatedDate: row.lastUpdatedDate,
  };
}

export function projectRegistryProfessional(row: {
  professionalId: string;
  fullName: string;
  socialName: string | null;
  occupationCode: string;
  municipalityId: string | null;
  employmentTypeCode: string | null;
  startDate: string | null;
  terminationDate: string | null;
  lastUpdatedDate: string | null;
}): RegistryProfessionalProjection {
  return {
    professionalId: row.professionalId,
    fullName: row.fullName,
    socialName: row.socialName,
    occupationCode: row.occupationCode,
    municipalityId: row.municipalityId,
    employmentTypeCode: row.employmentTypeCode,
    startDate: row.startDate,
    terminationDate: row.terminationDate,
    lastUpdatedDate: row.lastUpdatedDate,
  };
}

export function projectRegistryRepresentative(row: {
  facilityId: string;
  representativeName: string;
  roleTitle: string | null;
  email: string | null;
  taxId: string | null;
  lastUpdatedDate: string | null;
}): RegistryRepresentativeProjection {
  const externalKey = row.taxId?.trim() || row.representativeName.trim();

  return {
    facilityId: row.facilityId,
    externalKey,
    representativeName: row.representativeName,
    roleTitle: row.roleTitle,
    email: row.email,
    taxId: row.taxId,
    lastUpdatedDate: row.lastUpdatedDate,
  };
}

export function buildRegistryAddress(projection: RegistryFacilityProjection): string | null {
  const parts = [
    projection.streetAddress,
    projection.streetNumber,
    projection.addressComplement,
    projection.neighborhood,
    projection.postalCode,
  ].filter((part) => part && part.trim().length > 0);

  return parts.length > 0 ? parts.join(", ") : null;
}

export type {
  RegistryFacilityProjection,
  RegistryProfessionalProjection,
  RegistryRepresentativeProjection,
};
