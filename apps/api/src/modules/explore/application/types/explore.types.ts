export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface FacilityProfessionalLink {
  professionalId: string;
  fullName: string;
  occupationCode: string;
  occupationName: string | null;
  employmentTypeCode: string | null;
  councilCode: string | null;
  councilName: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseLabel: string | null;
  weeklyHoursAmbulatory: number | null;
}

export interface FacilityDto {
  facilityId: string;
  cnesCode: string | null;
  legalName: string | null;
  tradeName: string | null;
  fullAddress: string | null;
  neighborhood: string | null;
  postalCode: string | null;
  municipalityName: string | null;
  stateCode: string | null;
  stateName: string | null;
  phoneNumber: string | null;
  email: string | null;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  facilityType: string | null;
  facilityTypeCode: string | null;
  unitTypeCode: string | null;
  unitTypeName: string | null;
  unitSubtypeName: string | null;
  professionalCount: number;
  isActive: boolean;
  taxIdCnpj?: string | null;
  taxIdCpf?: string | null;
  is24_7?: boolean | null;
  isPhilanthropic?: boolean | null;
  hasInternet?: boolean | null;
  createdAt?: string | null;
  professionals?: FacilityProfessionalLink[];
}

export interface ProfessionalDto {
  professionalId: string;
  fullName: string;
  socialName: string | null;
  taxId: string | null;
  healthCardNumber: string | null;
  activeFacilitiesCount: number;
  currentFacilities: string | null;
  currentLocations: string | null;
  licenses: string | null;
  councils: string | null;
  occupationCodes: string | null;
  occupationLabels: string | null;
  activePositions: number;
  totalWeeklyHours: number | null;
  isPreceptor: boolean;
  isResident: boolean;
  lastEmploymentUpdate: string | null;
  lastWorkloadUpdate: string | null;
  facilityLinks?: Array<{
    facilityId: string;
    tradeName: string | null;
    municipalityName: string | null;
    occupationCode: string;
    occupationName: string | null;
    employmentTypeCode: string | null;
    weeklyHoursAmbulatory: number | null;
  }>;
}
