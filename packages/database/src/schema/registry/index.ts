import {
  pgTable,
  pgSchema,
  text,
  integer,
  timestamp,
  doublePrecision,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { geometryPoint } from "../../types/geometry";

export const registrySchema = pgSchema("registry");

export const registryFacilities = registrySchema.table("facilities", {
  facilityId: text("facility_id").primaryKey(),
  cnesCode: text("cnes_code"),
  legalName: text("legal_name"),
  tradeName: text("trade_name"),
  streetAddress: text("street_address"),
  streetNumber: text("street_number"),
  addressComplement: text("address_complement"),
  neighborhood: text("neighborhood"),
  postalCode: text("postal_code"),
  municipalityId: text("municipality_id"),
  healthRegionId: text("health_region_id"),
  phoneNumber: text("phone_number"),
  faxNumber: text("fax_number"),
  email: text("email"),
  websiteUrl: text("website_url"),
  location: geometryPoint("location"),
  taxIdCnpj: text("tax_id_cnpj"),
  taxIdCpf: text("tax_id_cpf"),
  ownerTaxId: text("owner_tax_id"),
  legalEntityTypeCode: text("legal_entity_type_code"),
  entityType: text("entity_type"),
  facilityTypeCode: text("facility_type_code"),
  primaryActivityCode: text("primary_activity_code"),
  unitTypeCode: text("unit_type_code"),
  operatingHoursCode: text("operating_hours_code"),
  deactivationReasonCode: text("deactivation_reason_code"),
  is_24_7: integer("is_24_7"),
  isPhilanthropic: integer("is_philanthropic"),
  hasInternet: integer("has_internet"),
  hasFormalContract: integer("has_formal_contract"),
  licenseIssueDate: text("license_issue_date"),
  sanitaryLicenseExpiry: text("sanitary_license_expiry"),
  lastUpdatedDate: text("last_updated_date"),
  updatedByUser: text("updated_by_user"),
  unitTypeName: text("unit_type_name"),
  unitSubtypeName: text("unit_subtype_name"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryAgreementTypes = registrySchema.table("agreement_types", {
  agreementCode: text("agreement_code").primaryKey(),
  agreementName: text("agreement_name").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryCareTypes = registrySchema.table("care_types", {
  careTypeCode: text("care_type_code").primaryKey(),
  careTypeName: text("care_type_name").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryDeactivationReasons = registrySchema.table("deactivation_reasons", {
  deactivationCode: text("deactivation_code").primaryKey(),
  deactivationReason: text("deactivation_reason").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryFacilityTypes = registrySchema.table("facility_types", {
  facilityTypeCode: text("facility_type_code").primaryKey(),
  facilityTypeName: text("facility_type_name").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryMunicipalities = registrySchema.table("municipalities", {
  municipalityId: text("municipality_id").primaryKey(),
  municipalityName: text("municipality_name").notNull(),
  stateCode: text("state_code").notNull(),
  registrationType: text("registration_type"),
  pactType: text("pact_type"),
  dataSubmissionType: text("data_submission_type"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryStates = registrySchema.table("states", {
  stateCode: text("state_code").primaryKey(),
  stateName: text("state_name").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryOccupations = registrySchema.table("occupations", {
  occupationCode: text("occupation_code").primaryKey(),
  occupationName: text("occupation_name").notNull(),
  professionalClassification: text("professional_classification"),
  isHealthOccupation: text("is_health_occupation"),
  isRegulated: text("is_regulated"),
  referenceYear: text("reference_year"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryProfessionals = registrySchema.table("professionals", {
  professionalId: text("professional_id").primaryKey(),
  fullName: text("full_name").notNull(),
  socialName: text("social_name"),
  taxId: text("tax_id"),
  healthCardNumber: text("health_card_number"),
  nationalityCode: text("nationality_code"),
  lastUpdatedDate: text("last_updated_date"),
  updatedByUser: text("updated_by_user"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryFacilityProfessionals = registrySchema.table(
  "facility_professionals",
  {
    facilityId: text("facility_id").notNull(),
    professionalId: text("professional_id").notNull(),
    occupationCode: text("occupation_code").notNull(),
    municipalityId: text("municipality_id"),
    serviceAreaId: text("service_area_id"),
    teamSequenceNumber: integer("team_sequence_number"),
    serviceType: text("service_type"),
    employmentTypeCode: text("employment_type_code"),
    startDate: text("start_date"),
    terminationDate: text("termination_date"),
    microAreaCode: text("micro_area_code"),
    otherTeamCnes: text("other_team_cnes"),
    lastUpdatedDate: text("last_updated_date"),
    updatedByUser: text("updated_by_user"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [primaryKey({ columns: [t.facilityId, t.professionalId, t.occupationCode] })]
);

export const registryFacilityAgreements = registrySchema.table(
  "facility_agreements",
  {
    facilityId: text("facility_id").notNull(),
    careTypeCode: text("care_type_code").notNull(),
    agreementCode: text("agreement_code").notNull(),
    updatedByUser: text("updated_by_user"),
    lastUpdatedDate: text("last_updated_date"),
    originUpdatedDate: text("origin_updated_date"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [primaryKey({ columns: [t.facilityId, t.careTypeCode, t.agreementCode] })]
);

export const registryFacilityRepresentatives = registrySchema.table(
  "facility_representatives",
  {
    facilityId: text("facility_id").primaryKey(),
    representativeName: text("representative_name").notNull(),
    roleTitle: text("role_title"),
    email: text("email"),
    taxId: text("tax_id"),
    updatedByUser: text("updated_by_user"),
    lastUpdatedDate: text("last_updated_date"),
    originUpdatedDate: text("origin_updated_date"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  }
);

export const registryMaintainers = registrySchema.table("maintainers", {
  taxId: text("tax_id").primaryKey(),
  legalName: text("legal_name"),
  bankCode: text("bank_code"),
  branchNumber: text("branch_number"),
  accountNumber: text("account_number"),
  streetAddress: text("street_address"),
  streetNumber: text("street_number"),
  addressComplement: text("address_complement"),
  neighborhood: text("neighborhood"),
  postalCode: text("postal_code"),
  municipalityId: text("municipality_id"),
  healthRegionId: text("health_region_id"),
  phoneNumber: text("phone_number"),
  formFilledDate: text("form_filled_date"),
  fmsFesStatus: text("fms_fes_status"),
  fmsFesTaxId: text("fms_fes_tax_id"),
  legalEntityTypeCode: text("legal_entity_type_code"),
  lastUpdatedDate: text("last_updated_date"),
  updatedByUser: text("updated_by_user"),
  managerCode: text("manager_code"),
  managerMunicipalityId: text("manager_municipality_id"),
  originUpdatedDate: text("origin_updated_date"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryServiceSpecialties = registrySchema.table("service_specialties", {
  serviceCode: text("service_code").primaryKey(),
  serviceName: text("service_name").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const registryProfessionalCouncils = registrySchema.table("professional_councils", {
  councilCode: text("council_code").primaryKey(),
  councilName: text("council_name").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
