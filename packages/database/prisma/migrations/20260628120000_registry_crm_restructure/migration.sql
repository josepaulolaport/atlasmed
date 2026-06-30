-- Registry + Truth CRM restructure (PR1)

-- New public enums
CREATE TYPE "ConformityStatus" AS ENUM ('INCOMPLETE', 'COMPLETE', 'EXPIRING_SOON', 'NON_CONFORMING');
CREATE TYPE "CommercialStatus" AS ENUM ('REGISTERED', 'COMMERCIALLY_ACTIVE', 'COMMERCIALLY_SUSPENDED', 'COMMERCIALLY_INACTIVE');
CREATE TYPE "ContactType" AS ENUM ('PROFESSIONAL', 'DECISOR', 'COMPRADOR');
CREATE TYPE "HealthcareProviderType" AS ENUM ('PRIVATE', 'PUBLIC', 'MIXED', 'OTHER');
CREATE TYPE "HealthcareProviderShareSource" AS ENUM ('MANUAL', 'REGISTRY', 'IMPORT');
CREATE TYPE "ConformityRecordStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'EXPIRED');

-- Extend IngestionSuggestionType via text cast
ALTER TABLE "ingestion_suggestions" ALTER COLUMN "type" SET DATA TYPE text;
DROP TYPE "IngestionSuggestionType";
CREATE TYPE "IngestionSuggestionType" AS ENUM (
  'FACILITY_FIELD_UPDATE',
  'FACILITY_REGISTRY_DEACTIVATED',
  'FACILITY_REGISTRY_REACTIVATED',
  'FACILITY_PROFESSIONAL_REMOVAL',
  'FACILITY_PROFESSIONAL_ADD',
  'FACILITY_REPRESENTATIVE_REMOVAL',
  'FACILITY_REPRESENTATIVE_ADD',
  'FACILITY_REPRESENTATIVE_FIELD_UPDATE',
  'CLINIC_REMOVAL',
  'CLINIC_REACTIVATION',
  'DOCTOR_CLINIC_REMOVAL'
);
UPDATE "ingestion_suggestions" SET "type" = 'FACILITY_REGISTRY_DEACTIVATED' WHERE "type" = 'CLINIC_REMOVAL';
UPDATE "ingestion_suggestions" SET "type" = 'FACILITY_REGISTRY_REACTIVATED' WHERE "type" = 'CLINIC_REACTIVATION';
UPDATE "ingestion_suggestions" SET "type" = 'FACILITY_PROFESSIONAL_REMOVAL' WHERE "type" = 'DOCTOR_CLINIC_REMOVAL';
ALTER TABLE "ingestion_suggestions" ALTER COLUMN "type" SET DATA TYPE "IngestionSuggestionType" USING "type"::"IngestionSuggestionType";

-- Rename truth tables
ALTER TABLE "clinics" RENAME TO "facilities";
ALTER TABLE "doctors" RENAME TO "professionals";
ALTER TABLE "doctor_clinic_associations" RENAME TO "facility_professionals";

-- Rename FK columns
ALTER TABLE "facility_professionals" RENAME COLUMN "doctorId" TO "professionalId";
ALTER TABLE "facility_professionals" RENAME COLUMN "clinicId" TO "facilityId";
ALTER TABLE "ingestion_suggestions" RENAME COLUMN "clinicId" TO "facilityId";
ALTER TABLE "ingestion_suggestions" RENAME COLUMN "doctorId" TO "professionalId";
ALTER TABLE "ingestion_suggestions" RENAME COLUMN "associationId" TO "facilityProfessionalId";
ALTER TABLE "territory_approval_requests" RENAME COLUMN "clinicId" TO "facilityId";

-- Expand facilities (formerly clinics)
ALTER TABLE "facilities" ADD COLUMN "cnes_code" TEXT;
ALTER TABLE "facilities" ADD COLUMN "legal_name" TEXT;
ALTER TABLE "facilities" ADD COLUMN "trade_name" TEXT;
ALTER TABLE "facilities" ADD COLUMN "street_address" TEXT;
ALTER TABLE "facilities" ADD COLUMN "street_number" TEXT;
ALTER TABLE "facilities" ADD COLUMN "address_complement" TEXT;
ALTER TABLE "facilities" ADD COLUMN "neighborhood" TEXT;
ALTER TABLE "facilities" ADD COLUMN "postal_code" TEXT;
ALTER TABLE "facilities" ADD COLUMN "phone_number" TEXT;
ALTER TABLE "facilities" ADD COLUMN "fax_number" TEXT;
ALTER TABLE "facilities" ADD COLUMN "email" TEXT;
ALTER TABLE "facilities" ADD COLUMN "website_url" TEXT;
ALTER TABLE "facilities" ADD COLUMN "tax_id_cnpj" TEXT;
ALTER TABLE "facilities" ADD COLUMN "tax_id_cpf" TEXT;
ALTER TABLE "facilities" ADD COLUMN "owner_tax_id" TEXT;
ALTER TABLE "facilities" ADD COLUMN "facility_type_code" TEXT;
ALTER TABLE "facilities" ADD COLUMN "registry_deactivation_code" TEXT;
ALTER TABLE "facilities" ADD COLUMN "is_active_in_registry" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "facilities" ADD COLUMN "reference_municipality_code" TEXT;
ALTER TABLE "facilities" ADD COLUMN "conformityStatus" "ConformityStatus" NOT NULL DEFAULT 'INCOMPLETE';
ALTER TABLE "facilities" ADD COLUMN "commercial_status" "CommercialStatus";
ALTER TABLE "facilities" ADD COLUMN "primary_sector_id" TEXT;
ALTER TABLE "facilities" ADD COLUMN "image_url" TEXT;

CREATE UNIQUE INDEX "facilities_sourceProvider_cnes_code_key" ON "facilities"("sourceProvider", "cnes_code");
CREATE INDEX "facilities_primary_sector_id_idx" ON "facilities"("primary_sector_id");
CREATE INDEX "facilities_conformityStatus_idx" ON "facilities"("conformityStatus");

-- Expand professionals (formerly doctors)
ALTER TABLE "professionals" ADD COLUMN "full_name" TEXT;
ALTER TABLE "professionals" ADD COLUMN "social_name" TEXT;
ALTER TABLE "professionals" ADD COLUMN "primary_specialty_label" TEXT;
ALTER TABLE "professionals" ADD COLUMN "crm_council" TEXT;
ALTER TABLE "professionals" ADD COLUMN "crm_number" TEXT;
ALTER TABLE "professionals" ADD COLUMN "crm_state" TEXT;
UPDATE "professionals" SET "primary_specialty_label" = "specialty" WHERE "specialty" IS NOT NULL;
UPDATE "professionals" SET "full_name" = TRIM("firstName" || ' ' || "lastName");
ALTER TABLE "professionals" DROP COLUMN "specialty";

-- Expand facility_professionals
ALTER TABLE "facility_professionals" ADD COLUMN "occupation_code" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "facility_professionals" ADD COLUMN "specialty_label" TEXT;
ALTER TABLE "facility_professionals" ADD COLUMN "employment_type_code" TEXT;
ALTER TABLE "facility_professionals" ADD COLUMN "source_occupation_code" TEXT;
ALTER TABLE "facility_professionals" ADD COLUMN "is_prescriber" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facility_professionals" ADD COLUMN "is_buyer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facility_professionals" ADD COLUMN "is_decision_maker" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facility_professionals" ADD COLUMN "relationship_level" TEXT;

DROP INDEX IF EXISTS "doctor_clinic_associations_doctorId_clinicId_key";
CREATE UNIQUE INDEX "facility_professionals_facilityId_professionalId_occupation_code_key"
  ON "facility_professionals"("facilityId", "professionalId", "occupation_code");

-- New truth tables
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sectors_slug_key" ON "sectors"("slug");
CREATE INDEX "sectors_is_active_idx" ON "sectors"("is_active");

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");
CREATE INDEX "products_sector_id_idx" ON "products"("sector_id");
CREATE INDEX "products_is_active_idx" ON "products"("is_active");
ALTER TABLE "products" ADD CONSTRAINT "products_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "healthcare_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HealthcareProviderType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "healthcare_providers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "healthcare_providers_is_active_idx" ON "healthcare_providers"("is_active");

ALTER TABLE "facilities" ADD CONSTRAINT "facilities_primary_sector_id_fkey" FOREIGN KEY ("primary_sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "facility_representatives" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "representative_name" TEXT NOT NULL,
    "role_title" TEXT,
    "email" TEXT,
    "tax_id" TEXT,
    "contact_type" "ContactType" NOT NULL DEFAULT 'PROFESSIONAL',
    "relationship_level" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "source_provider" TEXT,
    "external_source_key" TEXT,
    "source_active" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_user_id" TEXT,
    "ended_at" TIMESTAMP(3),
    "manually_edited_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "facility_representatives_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "facility_representatives_facilityId_external_source_key_key" ON "facility_representatives"("facilityId", "external_source_key");
CREATE INDEX "facility_representatives_facilityId_idx" ON "facility_representatives"("facilityId");
CREATE INDEX "facility_representatives_facilityId_source_active_ended_at_idx" ON "facility_representatives"("facilityId", "source_active", "ended_at");
CREATE INDEX "facility_representatives_facilityId_confirmed_at_ended_at_idx" ON "facility_representatives"("facilityId", "confirmed_at", "ended_at");
ALTER TABLE "facility_representatives" ADD CONSTRAINT "facility_representatives_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "facility_consultant_assignments" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "assigned_by_user_id" TEXT,
    "end_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "facility_consultant_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "facility_consultant_assignments_facilityId_idx" ON "facility_consultant_assignments"("facilityId");
CREATE INDEX "facility_consultant_assignments_userId_idx" ON "facility_consultant_assignments"("userId");
CREATE INDEX "facility_consultant_assignments_facilityId_ended_at_idx" ON "facility_consultant_assignments"("facilityId", "ended_at");
ALTER TABLE "facility_consultant_assignments" ADD CONSTRAINT "facility_consultant_assignments_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "facility_healthcare_provider_shares" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "healthcare_provider_id" TEXT NOT NULL,
    "share_percent" DOUBLE PRECISION NOT NULL,
    "source" "HealthcareProviderShareSource" NOT NULL DEFAULT 'MANUAL',
    "source_first_seen_at" TIMESTAMP(3),
    "source_last_seen_at" TIMESTAMP(3),
    "manually_edited_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "facility_healthcare_provider_shares_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "facility_healthcare_provider_shares_facility_id_healthcare_provider_id_key" ON "facility_healthcare_provider_shares"("facility_id", "healthcare_provider_id");
CREATE INDEX "facility_healthcare_provider_shares_facility_id_idx" ON "facility_healthcare_provider_shares"("facility_id");
CREATE INDEX "facility_healthcare_provider_shares_healthcare_provider_id_idx" ON "facility_healthcare_provider_shares"("healthcare_provider_id");
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "facility_healthcare_provider_shares" ADD CONSTRAINT "facility_healthcare_provider_shares_healthcare_provider_id_fkey" FOREIGN KEY ("healthcare_provider_id") REFERENCES "healthcare_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "conformity_requirements" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sector_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conformity_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "conformity_requirements_slug_key" ON "conformity_requirements"("slug");
CREATE INDEX "conformity_requirements_sector_id_idx" ON "conformity_requirements"("sector_id");
CREATE INDEX "conformity_requirements_is_active_idx" ON "conformity_requirements"("is_active");
ALTER TABLE "conformity_requirements" ADD CONSTRAINT "conformity_requirements_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "conformity_records" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "status" "ConformityRecordStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "validated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "validated_by_user_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conformity_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "conformity_records_facility_id_requirement_id_key" ON "conformity_records"("facility_id", "requirement_id");
CREATE INDEX "conformity_records_facility_id_idx" ON "conformity_records"("facility_id");
CREATE INDEX "conformity_records_requirement_id_idx" ON "conformity_records"("requirement_id");
CREATE INDEX "conformity_records_status_idx" ON "conformity_records"("status");
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conformity_records" ADD CONSTRAINT "conformity_records_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "conformity_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Registry schema (CNES warehouse mirror)
CREATE SCHEMA IF NOT EXISTS registry;
CREATE TABLE registry.facilities (
    facility_id text NOT NULL,
    cnes_code text,
    legal_name text,
    trade_name text,
    street_address text,
    street_number text,
    address_complement text,
    neighborhood text,
    postal_code text,
    municipality_id text,
    health_region_id text,
    phone_number text,
    fax_number text,
    email text,
    website_url text,
    latitude double precision,
    longitude double precision,
    tax_id_cnpj text,
    tax_id_cpf text,
    owner_tax_id text,
    legal_entity_type_code text,
    entity_type text,
    facility_type_code text,
    primary_activity_code text,
    unit_type_code text,
    operating_hours_code text,
    deactivation_reason_code text,
    is_24_7 integer DEFAULT 0,
    is_philanthropic integer DEFAULT 0,
    has_internet integer DEFAULT 0,
    has_formal_contract integer DEFAULT 0,
    license_issue_date text,
    sanitary_license_expiry text,
    last_updated_date text,
    updated_by_user text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unit_type_name text,
    unit_subtype_name text
);
CREATE TABLE registry.facility_types (
    facility_type_code text NOT NULL,
    facility_type_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.municipalities (
    municipality_id text NOT NULL,
    municipality_name text NOT NULL,
    state_code text NOT NULL,
    registration_type text,
    pact_type text,
    data_submission_type text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.states (
    state_code text NOT NULL,
    state_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.facility_professionals (
    facility_id text NOT NULL,
    professional_id text NOT NULL,
    occupation_code text NOT NULL,
    municipality_id text,
    service_area_id text,
    team_sequence_number integer,
    service_type text,
    employment_type_code text,
    start_date text,
    termination_date text,
    micro_area_code text,
    other_team_cnes text,
    last_updated_date text,
    updated_by_user text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.occupations (
    occupation_code text NOT NULL,
    occupation_name text NOT NULL,
    professional_classification text,
    is_health_occupation text,
    is_regulated text,
    reference_year text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.professional_workload (
    facility_id text NOT NULL,
    professional_id text NOT NULL,
    occupation_code text NOT NULL,
    weekly_hours_ambulatory integer,
    service_type text NOT NULL,
    employment_type_code text NOT NULL,
    professional_council_code text,
    license_number text,
    license_state text,
    is_preceptor integer,
    is_resident integer,
    last_updated_date text,
    updated_by_user text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.professionals (
    professional_id text NOT NULL,
    full_name text NOT NULL,
    social_name text,
    tax_id text,
    health_card_number text,
    nationality_code text,
    last_updated_date text,
    updated_by_user text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.agreement_types (
    agreement_code text NOT NULL,
    agreement_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.care_types (
    care_type_code text NOT NULL,
    care_type_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.deactivation_reasons (
    deactivation_code text NOT NULL,
    deactivation_reason text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.equipment_catalog (
    equipment_code text NOT NULL,
    equipment_type_code text NOT NULL,
    equipment_name text NOT NULL,
    renem_code text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.equipment_categories (
    category_code text NOT NULL,
    category_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.facility_agreements (
    facility_id text NOT NULL,
    care_type_code text NOT NULL,
    agreement_code text NOT NULL,
    updated_by_user text,
    last_updated_date text,
    origin_updated_date text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.facility_equipment (
    facility_id text NOT NULL,
    equipment_code text NOT NULL,
    equipment_category_code text NOT NULL,
    quantity integer,
    operational_status text,
    last_updated_date text,
    updated_by_user text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.facility_physical_installations (
    facility_id text NOT NULL,
    installation_code text NOT NULL,
    quantity integer,
    bed_count integer,
    last_updated_date text,
    updated_by_user text,
    origin_updated_date text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.facility_representatives (
    facility_id text NOT NULL,
    representative_name text NOT NULL,
    role_title text,
    email text,
    tax_id text,
    updated_by_user text,
    last_updated_date text,
    origin_updated_date text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.facility_services (
    facility_id text NOT NULL,
    service_code text NOT NULL,
    classification_code text NOT NULL,
    characteristic_type text NOT NULL,
    owner_tax_id text NOT NULL,
    address_complement text NOT NULL,
    ambulatory_capacity integer,
    ambulatory_capacity_sus integer,
    hospital_capacity integer,
    hospital_capacity_sus integer,
    is_active integer,
    last_updated_date text,
    updated_by_user text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.maintainers (
    tax_id text NOT NULL,
    legal_name text,
    bank_code text,
    branch_number text,
    account_number text,
    street_address text,
    street_number text,
    address_complement text,
    neighborhood text,
    postal_code text,
    municipality_id text,
    health_region_id text,
    phone_number text,
    form_filled_date text,
    fms_fes_status text,
    fms_fes_tax_id text,
    legal_entity_type_code text,
    last_updated_date text,
    updated_by_user text,
    manager_code text,
    manager_municipality_id text,
    origin_updated_date text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.physical_installations (
    installation_code text NOT NULL,
    installation_subtype_code text,
    installation_name text NOT NULL,
    installation_type_code text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.service_specialties (
    service_code text NOT NULL,
    service_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.installation_subtypes (
    installation_subtype_code text NOT NULL,
    installation_subtype_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.physical_installation_types (
    installation_type_code text NOT NULL,
    installation_type_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.professional_councils (
    council_code text NOT NULL,
    council_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE registry.service_classifications (
    classification_id text NOT NULL,
    service_specialty_code text NOT NULL,
    classification_name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE ONLY registry.agreement_types
    ADD CONSTRAINT agreement_types_pkey PRIMARY KEY (agreement_code);
ALTER TABLE ONLY registry.care_types
    ADD CONSTRAINT care_types_pkey PRIMARY KEY (care_type_code);
ALTER TABLE ONLY registry.deactivation_reasons
    ADD CONSTRAINT deactivation_reasons_pkey PRIMARY KEY (deactivation_code);
ALTER TABLE ONLY registry.equipment_catalog
    ADD CONSTRAINT equipment_catalog_pkey PRIMARY KEY (equipment_code, equipment_type_code);
ALTER TABLE ONLY registry.equipment_categories
    ADD CONSTRAINT equipment_categories_pkey PRIMARY KEY (category_code);
ALTER TABLE ONLY registry.facilities
    ADD CONSTRAINT facilities_cnes_code_key UNIQUE (cnes_code);
ALTER TABLE ONLY registry.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (facility_id);
ALTER TABLE ONLY registry.facility_agreements
    ADD CONSTRAINT facility_agreements_pkey PRIMARY KEY (facility_id, care_type_code, agreement_code);
ALTER TABLE ONLY registry.facility_equipment
    ADD CONSTRAINT facility_equipment_pkey PRIMARY KEY (facility_id, equipment_code, equipment_category_code);
ALTER TABLE ONLY registry.facility_physical_installations
    ADD CONSTRAINT facility_physical_installations_pkey PRIMARY KEY (facility_id, installation_code);
ALTER TABLE ONLY registry.facility_professionals
    ADD CONSTRAINT facility_professionals_pkey PRIMARY KEY (facility_id, professional_id, occupation_code);
ALTER TABLE ONLY registry.facility_representatives
    ADD CONSTRAINT facility_representatives_pkey PRIMARY KEY (facility_id);
ALTER TABLE ONLY registry.facility_services
    ADD CONSTRAINT facility_services_pkey PRIMARY KEY (facility_id, service_code, classification_code, characteristic_type, owner_tax_id, address_complement);
ALTER TABLE ONLY registry.facility_types
    ADD CONSTRAINT facility_types_pkey PRIMARY KEY (facility_type_code);
ALTER TABLE ONLY registry.installation_subtypes
    ADD CONSTRAINT installation_subtypes_pkey PRIMARY KEY (installation_subtype_code);
ALTER TABLE ONLY registry.maintainers
    ADD CONSTRAINT maintainers_pkey PRIMARY KEY (tax_id);
ALTER TABLE ONLY registry.municipalities
    ADD CONSTRAINT municipalities_pkey PRIMARY KEY (municipality_id);
ALTER TABLE ONLY registry.occupations
    ADD CONSTRAINT occupations_pkey PRIMARY KEY (occupation_code);
ALTER TABLE ONLY registry.physical_installation_types
    ADD CONSTRAINT physical_installation_types_pkey PRIMARY KEY (installation_type_code);
ALTER TABLE ONLY registry.physical_installations
    ADD CONSTRAINT physical_installations_pkey PRIMARY KEY (installation_code);
ALTER TABLE ONLY registry.professional_councils
    ADD CONSTRAINT professional_councils_pkey PRIMARY KEY (council_code);
ALTER TABLE ONLY registry.professional_workload
    ADD CONSTRAINT professional_workload_pkey PRIMARY KEY (facility_id, professional_id, occupation_code, employment_type_code, service_type);
ALTER TABLE ONLY registry.professionals
    ADD CONSTRAINT professionals_pkey PRIMARY KEY (professional_id);
ALTER TABLE ONLY registry.service_classifications
    ADD CONSTRAINT service_classifications_pkey PRIMARY KEY (classification_id, service_specialty_code);
ALTER TABLE ONLY registry.service_specialties
    ADD CONSTRAINT service_specialties_pkey PRIMARY KEY (service_code);
ALTER TABLE ONLY registry.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (state_code);
ALTER TABLE ONLY registry.facilities
    ADD CONSTRAINT facilities_deactivation_reason_code_fkey FOREIGN KEY (deactivation_reason_code) REFERENCES registry.deactivation_reasons(deactivation_code);
ALTER TABLE ONLY registry.facilities
    ADD CONSTRAINT facilities_facility_type_code_fkey FOREIGN KEY (facility_type_code) REFERENCES registry.facility_types(facility_type_code);
ALTER TABLE ONLY registry.facilities
    ADD CONSTRAINT facilities_municipality_id_fkey FOREIGN KEY (municipality_id) REFERENCES registry.municipalities(municipality_id);
ALTER TABLE ONLY registry.facilities
    ADD CONSTRAINT facilities_owner_tax_id_fkey FOREIGN KEY (owner_tax_id) REFERENCES registry.maintainers(tax_id);
ALTER TABLE ONLY registry.facility_agreements
    ADD CONSTRAINT facility_agreements_agreement_code_fkey FOREIGN KEY (agreement_code) REFERENCES registry.agreement_types(agreement_code);
ALTER TABLE ONLY registry.facility_agreements
    ADD CONSTRAINT facility_agreements_care_type_code_fkey FOREIGN KEY (care_type_code) REFERENCES registry.care_types(care_type_code);
ALTER TABLE ONLY registry.facility_agreements
    ADD CONSTRAINT facility_agreements_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES registry.facilities(facility_id);
ALTER TABLE ONLY registry.facility_equipment
    ADD CONSTRAINT facility_equipment_equipment_category_code_fkey FOREIGN KEY (equipment_category_code) REFERENCES registry.equipment_categories(category_code);
ALTER TABLE ONLY registry.facility_equipment
    ADD CONSTRAINT facility_equipment_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES registry.facilities(facility_id);
ALTER TABLE ONLY registry.facility_physical_installations
    ADD CONSTRAINT facility_physical_installations_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES registry.facilities(facility_id);
ALTER TABLE ONLY registry.facility_physical_installations
    ADD CONSTRAINT facility_physical_installations_installation_code_fkey FOREIGN KEY (installation_code) REFERENCES registry.physical_installations(installation_code);
ALTER TABLE ONLY registry.facility_professionals
    ADD CONSTRAINT facility_professionals_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES registry.facilities(facility_id);
ALTER TABLE ONLY registry.facility_professionals
    ADD CONSTRAINT facility_professionals_occupation_code_fkey FOREIGN KEY (occupation_code) REFERENCES registry.occupations(occupation_code);
ALTER TABLE ONLY registry.facility_professionals
    ADD CONSTRAINT facility_professionals_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES registry.professionals(professional_id);
ALTER TABLE ONLY registry.facility_representatives
    ADD CONSTRAINT facility_representatives_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES registry.facilities(facility_id);
ALTER TABLE ONLY registry.facility_services
    ADD CONSTRAINT facility_services_classification_fkey FOREIGN KEY (classification_code, service_code) REFERENCES registry.service_classifications(classification_id, service_specialty_code);
ALTER TABLE ONLY registry.facility_services
    ADD CONSTRAINT facility_services_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES registry.facilities(facility_id);
ALTER TABLE ONLY registry.facility_services
    ADD CONSTRAINT facility_services_service_code_fkey FOREIGN KEY (service_code) REFERENCES registry.service_specialties(service_code);
ALTER TABLE ONLY registry.municipalities
    ADD CONSTRAINT municipalities_state_code_fkey FOREIGN KEY (state_code) REFERENCES registry.states(state_code);
ALTER TABLE ONLY registry.physical_installations
    ADD CONSTRAINT physical_installations_installation_subtype_code_fkey FOREIGN KEY (installation_subtype_code) REFERENCES registry.installation_subtypes(installation_subtype_code);
ALTER TABLE ONLY registry.physical_installations
    ADD CONSTRAINT physical_installations_installation_type_code_fkey FOREIGN KEY (installation_type_code) REFERENCES registry.physical_installation_types(installation_type_code);
ALTER TABLE ONLY registry.professional_workload
    ADD CONSTRAINT professional_workload_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES registry.facilities(facility_id);
ALTER TABLE ONLY registry.professional_workload
    ADD CONSTRAINT professional_workload_occupation_code_fkey FOREIGN KEY (occupation_code) REFERENCES registry.occupations(occupation_code);
ALTER TABLE ONLY registry.professional_workload
    ADD CONSTRAINT professional_workload_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES registry.professionals(professional_id);
ALTER TABLE ONLY registry.service_classifications
    ADD CONSTRAINT service_classifications_service_specialty_code_fkey FOREIGN KEY (service_specialty_code) REFERENCES registry.service_specialties(service_code);
